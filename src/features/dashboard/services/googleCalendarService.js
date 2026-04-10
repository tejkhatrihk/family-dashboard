const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Parse family members from env: "Name:calendarId:color,Name2:calendarId2:color2"
export function getFamilyMembers() {
  const raw = import.meta.env.VITE_FAMILY_MEMBERS || "";
  return raw
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [name, calendarId, color] = entry.split(":");
      return {
        name,
        calendarId: calendarId || "primary",
        color: color || "#1a73e8",
      };
    });
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
  }));
}

/**
 * Fetch events from ALL family calendars.
 */
export async function fetchAllFamilyEvents(accessToken, timeMin, timeMax) {
  const members = getFamilyMembers();
  const results = await Promise.allSettled(
    members.map(async (member) => {
      const events = await fetchGoogleEvents(
        accessToken,
        timeMin,
        timeMax,
        member.calendarId,
      );
      return events.map((e) => ({
        ...e,
        owner: member.name,
        color: member.color,
      }));
    }),
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

/**
 * Create a new event in a specific Google Calendar.
 */
export async function createGoogleEvent(
  accessToken,
  event,
  calendarId = "primary",
) {
  const body = {
    summary: event.title,
    description: event.description || "",
    start: event.allDay
      ? { date: formatDate(event.start) }
      : { dateTime: event.start.toISOString() },
    end: event.allDay
      ? { date: formatDate(event.end) }
      : { dateTime: event.end.toISOString() },
  };

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
  const body = {
    summary: event.title,
    description: event.description || "",
    start: event.allDay
      ? { date: formatDate(event.start) }
      : { dateTime: event.start.toISOString() },
    end: event.allDay
      ? { date: formatDate(event.end) }
      : { dateTime: event.end.toISOString() },
  };

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