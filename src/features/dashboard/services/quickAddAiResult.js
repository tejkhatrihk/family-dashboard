import { addDays, isValid } from "date-fns";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseLocalDateTime(date, time = "00:00") {
  if (!DATE_PATTERN.test(date || "") || !TIME_PATTERN.test(time || "")) return null;
  const value = new Date(`${date}T${time}:00`);
  return isValid(value) ? value : null;
}

function findMember(aiResult, members) {
  return members.find(
    (member) =>
      (aiResult.familyMemberId && member.id === aiResult.familyMemberId) ||
      (aiResult.familyMemberName &&
        member.name.toLowerCase() === aiResult.familyMemberName.toLowerCase()),
  );
}

function buildRecurrence(aiResult, fallbackRecurrence) {
  if (aiResult.frequency === "none") return fallbackRecurrence || null;
  return {
    frequency: aiResult.frequency,
    interval: aiResult.interval || 1,
    weekdays: aiResult.weekdays || [],
    endType: aiResult.recurrenceEndDate ? "until" : "never",
    until: aiResult.recurrenceEndDate || null,
    count: 10,
  };
}

export function normalizeAiQuickAddResult(
  originalText,
  aiResult,
  { members = [], deterministicResult = null } = {},
) {
  const fallback = deterministicResult?.draft || {};
  const member = findMember(aiResult, members) || members.find(
    (candidate) => candidate.id === fallback.ownerId || candidate.name === fallback.owner,
  );
  const date = DATE_PATTERN.test(aiResult.date || "")
    ? aiResult.date
    : deterministicResult?.parsed?.date || null;
  const startTime = TIME_PATTERN.test(aiResult.startTime || "")
    ? aiResult.startTime
    : deterministicResult?.parsed?.startTime || null;
  const endTime = TIME_PATTERN.test(aiResult.endTime || "")
    ? aiResult.endTime
    : deterministicResult?.parsed?.endTime || null;
  const allDay = Boolean(date && aiResult.allDay && !startTime);
  const start = allDay
    ? parseLocalDateTime(date)
    : parseLocalDateTime(date, startTime);
  let end = allDay
    ? addDays(start, 1)
    : parseLocalDateTime(date, endTime);
  if (start && end && end <= start) end = addDays(end, 1);

  const recurrence = buildRecurrence(aiResult, fallback.recurrence);
  const title = aiResult.title?.trim() || fallback.title || "";
  const ambiguities = Array.isArray(aiResult.ambiguities) ? aiResult.ambiguities : [];
  const missingFields = [];
  if (!title) missingFields.push("title");
  if (!member) missingFields.push("familyMember");
  if (!date) missingFields.push("date");
  if (!allDay && !startTime && !ambiguities.some((issue) => issue.field === "startTime")) {
    missingFields.push("startTime");
  }
  if (!allDay && !end) missingFields.push("endTime");

  return {
    originalText,
    source: "ai",
    draft: {
      title,
      ownerId: member?.id || null,
      owner: member?.name || "",
      start,
      end,
      allDay,
      description: aiResult.notes?.trim() || fallback.description || "",
      location: aiResult.location?.trim() || fallback.location || "",
      recurrence,
    },
    parsed: {
      date,
      startTime,
      endTime,
      dayOfWeek: null,
    },
    missingFields,
    ambiguities,
    warnings: [],
    needsAi: false,
  };
}
