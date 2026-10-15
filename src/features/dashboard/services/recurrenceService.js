import {
  addDays,
  addMonths,
  addYears,
  endOfDay,
  isAfter,
  isBefore,
  isEqual,
  startOfWeek,
} from "date-fns";

export const WEEKDAYS = [
  { value: "MO", label: "M", longLabel: "Monday", day: 1 },
  { value: "TU", label: "T", longLabel: "Tuesday", day: 2 },
  { value: "WE", label: "W", longLabel: "Wednesday", day: 3 },
  { value: "TH", label: "T", longLabel: "Thursday", day: 4 },
  { value: "FR", label: "F", longLabel: "Friday", day: 5 },
  { value: "SA", label: "S", longLabel: "Saturday", day: 6 },
  { value: "SU", label: "S", longLabel: "Sunday", day: 0 },
];

export const RECURRENCE_PRESETS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_GENERATED_OCCURRENCES = 20_000;

export function getWeekdayValue(date) {
  return WEEKDAYS.find((weekday) => weekday.day === date.getDay())?.value;
}

export function createRecurrenceFromPreset(preset, start) {
  if (preset === "none") return null;

  const [frequency, interval] =
    preset === "biweekly" ? ["weekly", 2] : [preset, 1];

  return {
    frequency,
    interval,
    weekdays: frequency === "weekly" ? [getWeekdayValue(start)] : [],
    endType: "never",
    until: null,
    count: 10,
  };
}

export function getRecurrencePreset(recurrence) {
  if (!recurrence?.frequency) return "none";
  if (recurrence.frequency === "weekly" && recurrence.interval === 2) {
    return "biweekly";
  }
  return recurrence.frequency;
}

export function updateRecurrenceForStartChange(
  recurrence,
  previousStart,
  nextStart,
) {
  if (recurrence?.frequency !== "weekly") return recurrence;
  if (!nextStart) return recurrence;
  if (!previousStart) {
    return { ...recurrence, weekdays: [getWeekdayValue(nextStart)] };
  }

  const previousDay = getWeekdayValue(previousStart);
  if (
    recurrence.weekdays?.length === 1 &&
    recurrence.weekdays[0] === previousDay
  ) {
    return { ...recurrence, weekdays: [getWeekdayValue(nextStart)] };
  }

  return recurrence;
}

export function isRecurrenceValid(event) {
  const recurrence = event?.recurrence;
  if (!recurrence) return true;
  if (!event?.start) return false;

  if (
    recurrence.frequency === "weekly" &&
    !recurrence.weekdays?.includes(getWeekdayValue(event.start))
  ) {
    return false;
  }

  if (recurrence.endType === "until") {
    if (!recurrence.until) return false;
    const until = endOfDay(new Date(`${recurrence.until}T00:00:00`));
    if (isBefore(until, event.start)) return false;
  }
  if (recurrence.endType === "count" && recurrence.count < 1) return false;
  return true;
}

export function getRecurrenceValidationMessage(event) {
  const recurrence = event?.recurrence;
  if (!recurrence) return "";
  if (!event?.start) return "Choose a start date and time for this repeating event.";

  if (
    recurrence.frequency === "weekly" &&
    !recurrence.weekdays?.includes(getWeekdayValue(event.start))
  ) {
    return "Choose the start date's weekday, or change the start date.";
  }
  if (recurrence.endType === "until" && !recurrence.until) {
    return "Choose when this repeating event ends.";
  }
  if (recurrence.endType === "until") {
    const until = endOfDay(new Date(`${recurrence.until}T00:00:00`));
    if (isBefore(until, event.start)) {
      return "The repeat end date must be on or after the event starts.";
    }
  }
  return "";
}

export function buildGoogleRecurrence(recurrence) {
  if (!recurrence?.frequency) return undefined;

  const parts = [
    `FREQ=${recurrence.frequency.toUpperCase()}`,
    `INTERVAL=${Math.max(1, Number(recurrence.interval) || 1)}`,
  ];

  if (recurrence.frequency === "weekly" && recurrence.weekdays?.length) {
    parts.push(`BYDAY=${recurrence.weekdays.join(",")}`, "WKST=MO");
  }

  if (recurrence.endType === "count") {
    parts.push(`COUNT=${Math.max(1, Number(recurrence.count) || 1)}`);
  } else if (recurrence.endType === "until" && recurrence.until) {
    const until = endOfDay(new Date(`${recurrence.until}T00:00:00`));
    const utcUntil = until
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    parts.push(`UNTIL=${utcUntil}`);
  }

  return [`RRULE:${parts.join(";")}`];
}

function happensOnWeeklyDate(seriesStart, candidate, recurrence) {
  const firstWeekStart = startOfWeek(seriesStart, { weekStartsOn: 1 });
  const calendarDayDifference = Math.round(
    (Date.UTC(candidate.getFullYear(), candidate.getMonth(), candidate.getDate()) -
      Date.UTC(
        firstWeekStart.getFullYear(),
        firstWeekStart.getMonth(),
        firstWeekStart.getDate(),
      )) /
      DAY_IN_MS,
  );
  const weekIndex = Math.floor(calendarDayDifference / 7);
  return (
    weekIndex % Math.max(1, Number(recurrence.interval) || 1) === 0 &&
    recurrence.weekdays.includes(getWeekdayValue(candidate))
  );
}

function isWithinRange(date, rangeStart, rangeEnd) {
  return (
    (isAfter(date, rangeStart) || isEqual(date, rangeStart)) &&
    (isBefore(date, rangeEnd) || isEqual(date, rangeEnd))
  );
}

function createOccurrence(event, start, duration) {
  return {
    ...event,
    id: `${event.id}__${start.getTime()}`,
    start,
    end: new Date(start.getTime() + duration),
    recurrenceParentId: event.id,
    reminderId: event.id,
  };
}

function expandEvent(event, rangeStart, rangeEnd) {
  const { recurrence } = event;
  const duration = event.end.getTime() - event.start.getTime();
  const until =
    recurrence.endType === "until" && recurrence.until
      ? endOfDay(new Date(`${recurrence.until}T00:00:00`))
      : null;
  const countLimit =
    recurrence.endType === "count"
      ? Math.max(1, Number(recurrence.count) || 1)
      : Infinity;
  const occurrences = [];
  let occurrenceCount = 0;
  let iterations = 0;
  let candidate = new Date(event.start);
  const interval = Math.max(1, Number(recurrence.interval) || 1);

  while (
    !isAfter(candidate, rangeEnd) &&
    (!until || !isAfter(candidate, until)) &&
    occurrenceCount < countLimit &&
    iterations < MAX_GENERATED_OCCURRENCES
  ) {
    let matches = true;

    if (recurrence.frequency === "weekly") {
      matches = happensOnWeeklyDate(event.start, candidate, recurrence);
    }

    if (matches) {
      occurrenceCount += 1;
      if (isWithinRange(candidate, rangeStart, rangeEnd)) {
        occurrences.push(createOccurrence(event, candidate, duration));
      }
    }

    iterations += 1;
    if (recurrence.frequency === "daily") {
      candidate = addDays(event.start, iterations * interval);
    } else if (recurrence.frequency === "weekly") {
      candidate = addDays(candidate, 1);
    } else if (recurrence.frequency === "monthly") {
      candidate = addMonths(event.start, iterations * interval);
    } else if (recurrence.frequency === "yearly") {
      candidate = addYears(event.start, iterations * interval);
    } else {
      break;
    }
  }

  return occurrences;
}

export function expandRecurringEvents(events, rangeStart, rangeEnd) {
  return events.flatMap((event) =>
    event.recurrence
      ? expandEvent(event, rangeStart, rangeEnd)
      : [{ ...event, reminderId: event.id }],
  );
}
