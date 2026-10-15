import { addDays, format, isValid, parse } from "date-fns";
import { getWeekdayValue, WEEKDAYS } from "./recurrenceService.js";

const WEEKDAY_LOOKUP = new Map(
  WEEKDAYS.map((weekday) => [weekday.longLabel.toLowerCase(), weekday]),
);
const WEEKDAY_NAMES = WEEKDAYS.map((weekday) => weekday.longLabel).join("|");
const WEEKDAY_RANGE_REGEX = new RegExp(
  `\\b(?:from\\s+)?(${WEEKDAY_NAMES})\\s*(?:to|through|thru|-|\\u2013|\\u2014)\\s*(${WEEKDAY_NAMES})\\b`,
  "i",
);
const MONTH_DATE_FORMATS = [
  "MMMM d yyyy",
  "MMM d yyyy",
  "MMMM d",
  "MMM d",
  "yyyy-MM-dd",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function removeMatch(text, match) {
  return match ? text.replace(match[0], " ") : text;
}

function parseCalendarDate(value, referenceDate) {
  const normalized = value.replace(/,/g, "").trim();
  for (const pattern of MONTH_DATE_FORMATS) {
    const parsed = parse(normalized, pattern, referenceDate);
    if (!isValid(parsed)) continue;

    const includesYear = /\b\d{4}\b/.test(normalized) || pattern === "yyyy-MM-dd";
    if (!includesYear && parsed < referenceDate) {
      parsed.setFullYear(parsed.getFullYear() + 1);
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  return null;
}

function parseClockValue(rawValue, fallbackMeridiem = null) {
  const normalized = rawValue.trim().toLowerCase().replace(/\./g, "");
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return { value: null, ambiguous: false };

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3] || fallbackMeridiem;
  if (minute > 59 || hour > 23) return { value: null, ambiguous: false };

  if (!meridiem && hour <= 12) {
    return {
      value: null,
      ambiguous: true,
      options: [
        `${String(hour % 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        `${String((hour % 12) + 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      ],
    };
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return { value: null, ambiguous: false };
    hour %= 12;
    if (meridiem === "pm") hour += 12;
  }

  return {
    value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    ambiguous: false,
  };
}

function combineDateAndTime(date, clockValue) {
  if (!date || !clockValue) return null;
  const [hour, minute] = clockValue.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function resolveWeekday(referenceDate, weekday, clockValue, forceFollowingWeek) {
  const result = new Date(referenceDate);
  result.setSeconds(0, 0);
  let daysAhead = (weekday.day - result.getDay() + 7) % 7;

  if (forceFollowingWeek && daysAhead === 0) daysAhead = 7;
  result.setDate(result.getDate() + daysAhead);

  if (clockValue) {
    const [hour, minute] = clockValue.split(":").map(Number);
    result.setHours(hour, minute, 0, 0);
    if (!forceFollowingWeek && daysAhead === 0 && result <= referenceDate) {
      result.setDate(result.getDate() + 7);
    }
  } else {
    result.setHours(0, 0, 0, 0);
  }
  return result;
}

function findMember(text, members) {
  return [...members]
    .sort((first, second) => second.name.length - first.name.length)
    .find((member) =>
      new RegExp(`(^|\\b)${escapeRegExp(member.name)}(?=\\b|$)`, "i").test(text),
    );
}

function getWeekdaysInRange(firstWeekday, lastWeekday) {
  const firstIndex = WEEKDAYS.indexOf(firstWeekday);
  const lastIndex = WEEKDAYS.indexOf(lastWeekday);
  if (firstIndex < 0 || lastIndex < 0) return [];

  const weekdays = [];
  let currentIndex = firstIndex;
  do {
    weekdays.push(WEEKDAYS[currentIndex]);
    if (currentIndex === lastIndex) break;
    currentIndex = (currentIndex + 1) % WEEKDAYS.length;
  } while (currentIndex !== firstIndex);

  return weekdays;
}

function parseWeekdayRange(text) {
  const match = text.match(WEEKDAY_RANGE_REGEX);
  if (!match) return null;

  const firstWeekday = WEEKDAY_LOOKUP.get(match[1].toLowerCase());
  const lastWeekday = WEEKDAY_LOOKUP.get(match[2].toLowerCase());
  return {
    match,
    firstWeekday,
    weekdays: getWeekdaysInRange(firstWeekday, lastWeekday),
  };
}

function buildRecurrence(text, weekday, start, weekdayRange = []) {
  const lowerText = text.toLowerCase();
  let frequency = null;
  let interval = 1;

  if (weekdayRange.length > 0) frequency = "weekly";
  else if (/\b(?:every day|daily)\b/.test(lowerText)) frequency = "daily";
  else if (/\b(?:every other week|biweekly|fortnightly)\b/.test(lowerText)) {
    frequency = "weekly";
    interval = 2;
  } else if (/\b(?:every week|weekly)\b/.test(lowerText) || /\bevery\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lowerText)) {
    frequency = "weekly";
  } else if (/\b(?:every month|monthly)\b/.test(lowerText)) frequency = "monthly";
  else if (/\b(?:every year|yearly|annually)\b/.test(lowerText)) frequency = "yearly";

  if (!frequency) return null;
  return {
    frequency,
    interval,
    weekdays:
      frequency === "weekly"
        ? (weekdayRange.length > 0
            ? weekdayRange.map((rangeWeekday) => rangeWeekday.value)
            : [weekday?.value || (start ? getWeekdayValue(start) : null)].filter(Boolean))
        : [],
    endType: "never",
    until: null,
    count: 10,
  };
}

function cleanTitle(text) {
  return capitalize(
    text
      .replace(/\b(?:please|add|schedule|book|will)\b/gi, " ")
      .replace(/^\s*(?:(?:has|have)(?:\s+to)?\s+)?(?:(?:a|an)\s+)?/i, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, "")
      .trim(),
  );
}

export function parseQuickAdd(input, { members = [], now = new Date() } = {}) {
  const originalText = input.trim();
  let workingText = originalText;
  const missingFields = [];
  const ambiguities = [];
  const warnings = [];

  const member = findMember(workingText, members);
  if (member) {
    workingText = workingText.replace(
      new RegExp(`(^|\\b)${escapeRegExp(member.name)}(?:'s)?(?=\\b|$)`, "i"),
      " ",
    );
  } else {
    missingFields.push("familyMember");
  }

  const notesMatch = workingText.match(/\bnotes?\s*:\s*(.+)$/i);
  const description = notesMatch?.[1]?.trim() || "";
  workingText = removeMatch(workingText, notesMatch);

  const locationMatch = workingText.match(/\b(?:location\s*:|@)\s*([^,;]+?)(?=\s+notes?\s*:|$)/i);
  const location = locationMatch?.[1]?.trim() || "";
  workingText = removeMatch(workingText, locationMatch);

  const untilMatch = workingText.match(
    /\b(?:until|through)\s+((?:[a-z]+\s+\d{1,2}(?:,?\s+\d{4})?)|(?:\d{4}-\d{2}-\d{2}))/i,
  );
  const recurrenceEndDate = untilMatch
    ? parseCalendarDate(untilMatch[1], now)
    : null;
  if (untilMatch && !recurrenceEndDate) {
    ambiguities.push({
      field: "recurrenceEndDate",
      message: `Could not understand “${untilMatch[1]}” as an end date.`,
    });
  }
  workingText = removeMatch(workingText, untilMatch);

  const timeRangeMatch = workingText.match(
    /\b(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)(?:\s*(?:to|[-–])\s*)(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/i,
  );
  const singleTimeMatch = timeRangeMatch
    ? null
    : workingText.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i);
  const durationMatch = workingText.match(
    /\bfor\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/i,
  );
  const vagueTimeMatch = workingText.match(
    /\b(morning|afternoon|evening|night)\b/i,
  );

  let startClock = null;
  let endClock = null;
  let hasUnresolvedClock = false;
  if (timeRangeMatch) {
    const endMeridiem = timeRangeMatch[2].toLowerCase().match(/(am|pm|a\.m\.|p\.m\.)/)?.[1]?.replace(/\./g, "") || null;
    const parsedStart = parseClockValue(timeRangeMatch[1], endMeridiem);
    const parsedEnd = parseClockValue(timeRangeMatch[2]);
    startClock = parsedStart.value;
    endClock = parsedEnd.value;
    if (parsedStart.ambiguous) {
      hasUnresolvedClock = true;
      ambiguities.push({ field: "startTime", message: "Is the start time AM or PM?", options: parsedStart.options });
    }
    if (parsedEnd.ambiguous) {
      hasUnresolvedClock = true;
      ambiguities.push({ field: "endTime", message: "Is the end time AM or PM?", options: parsedEnd.options });
    }
    workingText = removeMatch(workingText, timeRangeMatch);
  } else if (singleTimeMatch) {
    const parsedStart = parseClockValue(singleTimeMatch[1]);
    startClock = parsedStart.value;
    if (parsedStart.ambiguous) {
      hasUnresolvedClock = true;
      ambiguities.push({ field: "startTime", message: "Is the time AM or PM?", options: parsedStart.options });
    }
    workingText = removeMatch(workingText, singleTimeMatch);
  }
  if (!timeRangeMatch && !singleTimeMatch && vagueTimeMatch) {
    warnings.push(
      `“${capitalize(vagueTimeMatch[1].toLowerCase())}” has no exact time, so this event is set to Anytime.`,
    );
  }
  workingText = removeMatch(workingText, durationMatch);
  workingText = removeMatch(workingText, vagueTimeMatch);

  const weekdayRange = parseWeekdayRange(workingText);
  const weekdayMatch = weekdayRange
    ? null
    : workingText.match(
        /\b(next\s+)?(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      );
  const weekday = weekdayRange?.firstWeekday || (weekdayMatch
    ? WEEKDAY_LOOKUP.get(weekdayMatch[2].toLowerCase())
    : null);

  const relativeDateMatch = workingText.match(/\b(today|tomorrow)\b/i);
  const explicitDateMatch = workingText.match(
    /\b((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2})\b/i,
  );

  let eventDate = null;
  if (relativeDateMatch) {
    eventDate = new Date(now);
    if (relativeDateMatch[1].toLowerCase() === "tomorrow") eventDate = addDays(eventDate, 1);
    eventDate.setHours(0, 0, 0, 0);
    workingText = removeMatch(workingText, relativeDateMatch);
  } else if (explicitDateMatch) {
    eventDate = parseCalendarDate(explicitDateMatch[1], now);
    workingText = removeMatch(workingText, explicitDateMatch);
  } else if (weekday) {
    eventDate = resolveWeekday(now, weekday, startClock, Boolean(weekdayMatch?.[1]));
  }
  workingText = removeMatch(workingText, weekdayRange?.match || weekdayMatch);

  const recurrence = buildRecurrence(
    originalText,
    weekday,
    eventDate,
    weekdayRange?.weekdays,
  );
  if (recurrenceEndDate && recurrence) {
    recurrence.endType = "until";
    recurrence.until = format(recurrenceEndDate, "yyyy-MM-dd");
  } else if (recurrenceEndDate && !recurrence) {
    warnings.push("An end date was found, but the sentence did not include a repeat schedule.");
  }

  const isAnytime = Boolean(eventDate && !startClock && !hasUnresolvedClock);
  const start = isAnytime ? new Date(eventDate) : combineDateAndTime(eventDate, startClock);
  let end = isAnytime ? addDays(start, 1) : combineDateAndTime(eventDate, endClock);
  if (!end && start && durationMatch) {
    const amount = Number(durationMatch[1]);
    const isHour = durationMatch[2].toLowerCase().startsWith("h");
    end = new Date(start.getTime() + amount * (isHour ? 60 : 1) * 60_000);
  }
  if (start && end && end <= start) end = addDays(end, 1);

  workingText = workingText
    .replace(/\b(?:every other week|every week|every day|weekly|daily|biweekly|fortnightly|monthly|yearly|annually)\b/gi, " ")
    .replace(/\bevery\b/gi, " ");
  const title = cleanTitle(workingText);

  if (!title) missingFields.push("title");
  if (!eventDate) missingFields.push("date");
  if (!isAnytime && !startClock && !ambiguities.some((issue) => issue.field === "startTime")) {
    missingFields.push("startTime");
  }
  if (!isAnytime && !end) missingFields.push("endTime");

  return {
    originalText,
    source: "deterministic",
    draft: {
      title,
      ownerId: member?.id || null,
      owner: member?.name || "",
      start,
      end,
      allDay: isAnytime,
      description,
      location,
      recurrence,
    },
    parsed: {
      date: eventDate ? format(eventDate, "yyyy-MM-dd") : null,
      startTime: startClock,
      endTime: endClock,
      dayOfWeek: weekday?.longLabel || null,
    },
    missingFields: [...new Set(missingFields)],
    ambiguities,
    warnings,
    needsAi:
      ambiguities.length > 0 ||
      !title ||
      missingFields.includes("date"),
  };
}
