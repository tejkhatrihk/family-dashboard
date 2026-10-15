export function applyQuickAddResult(baseEvent, parsedResult, familyMembers) {
  const { draft } = parsedResult;
  const member = familyMembers.find(
    (candidate) =>
      candidate.id === draft.ownerId || candidate.name === draft.owner,
  );

  return {
    ...baseEvent,
    title: draft.title || "",
    description: draft.description || "",
    location: draft.location || "",
    start: draft.start || null,
    end: draft.end || null,
    scheduleDate: parsedResult.parsed.date || null,
    allDay: Boolean(draft.allDay),
    owner: member?.name || "",
    calendarId: member?.calendarId || "primary",
    color: member?.color || baseEvent?.color,
    recurrence: draft.recurrence || null,
  };
}
