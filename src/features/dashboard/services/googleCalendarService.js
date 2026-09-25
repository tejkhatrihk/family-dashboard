import { buildGoogleRecurrence } from "./recurrenceService";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CHECKLIST_PROPERTY = "familyDashboardChecklist";

function parseChecklist(item) {
  try {
    return JSON.parse(
      item.extendedProperties?.private?.[CHECKLIST_PROPERTY] || "[]",
    );
  } catch {
    return [];
  }
}

/**
 * Fetch events from a specific Google Calendar for a given time range.
 */
export async function fetchGoogleEvents(
  accessToken,
  timeMin,
  timeMax,
  calendarId = "primary",
) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const encodedId = encodeURIComponent(calendarId);
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodedId}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) throw new Error(`Google API error: ${res.status}`);

  const data = await res.json();

  return (data.items || []).map((item) => ({
    id: item.id,
    title: item.summary || "(No title)",
    start: new Date(item.start.dateTime || item.start.date),
    end: new Date(item.end.dateTime || item.end.date),
    allDay: !!item.start.date,
    source: "google",
    calendarId,
    description: item.description || "",
    checklist: parseChecklist(item),
    recurrenceParentId: item.recurringEventId,
    reminderId: item.recurringEventId || item.id,
  }));
}

function buildGoogleEventBody(event) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const recurrence = buildGoogleRecurrence(event.recurrence);

  return {
    summary: event.title,
    description: event.description || "",
    extendedProperties: {
      private: {
        [CHECKLIST_PROPERTY]: JSON.stringify(event.checklist || []),
      },
    },
    start: event.allDay
      ? { date: formatDate(event.start) }
      : { dateTime: event.start.toISOString(), ...(recurrence && { timeZone }) },
    end: event.allDay
      ? { date: formatDate(event.end) }
      : { dateTime: event.end.toISOString(), ...(recurrence && { timeZone }) },
    ...(recurrence && { recurrence }),
  };
}

/**
 * Fetch events from ALL family calendars.
 */
export async function fetchAllFamilyEvents(
  accessToken,
  timeMin,
  timeMax,
  members,
) {
  const results = await Promise.allSettled(
    members.map(async (member) => {
      const events = await fetchGoogleEvents(
        accessToken,
        timeMin,
        timeMax,
        member.calendarId,
      );
      return events.map((event) => ({
        ...event,
        owner: member.name,
        color: member.color,
      }));
    }),
  );

  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);
}

/**
 * Create a new event in a specific Google Calendar.
 */
export async function createGoogleEvent(
  accessToken,
  event,
  calendarId = "primary",
) {
  const body = buildGoogleEventBody(event);

  const encodedId = encodeURIComponent(calendarId);
  const res = await fetch(`${CALENDAR_API}/calendars/${encodedId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Google API error: ${res.status}`);
  return res.json();
}

/**
 * Update an existing event in a specific Google Calendar.
 */
export async function updateGoogleEvent(
  accessToken,
  eventId,
  event,
  calendarId = "primary",
) {
  const body = buildGoogleEventBody(event);

  const encodedId = encodeURIComponent(calendarId);
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodedId}/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) throw new Error(`Google API error: ${res.status}`);
  return res.json();
}

/**
 * Delete an event from a specific Google Calendar.
 */
export async function deleteGoogleEvent(
  accessToken,
  eventId,
  calendarId = "primary",
) {
  const encodedId = encodeURIComponent(calendarId);
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodedId}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Google API error: ${res.status}`);
  }
}

/** Format Date to YYYY-MM-DD for all-day events. */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
