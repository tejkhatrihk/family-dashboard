import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAiQuickAddResult } from "./quickAddAiResult.js";

const members = [{ id: "tej", name: "Tej" }];

test("normalizes an AI date-only result as an anytime event", () => {
  const result = normalizeAiQuickAddResult(
    "I should clean the bathrooms sometime next Tuesday",
    {
      title: "Clean bathrooms",
      familyMemberId: "tej",
      familyMemberName: "Tej",
      date: "2026-09-29",
      startTime: null,
      endTime: null,
      allDay: true,
      frequency: "none",
      interval: 1,
      weekdays: [],
      recurrenceEndDate: null,
      location: null,
      notes: null,
      ambiguities: [],
    },
    { members },
  );

  assert.equal(result.source, "ai");
  assert.equal(result.draft.title, "Clean bathrooms");
  assert.equal(result.draft.owner, "Tej");
  assert.equal(result.draft.allDay, true);
  assert.equal(result.draft.start.getDate(), 29);
  assert.equal(result.draft.end.getDate(), 30);
  assert.deepEqual(result.missingFields, []);
});

test("does not invent an ambiguous time returned by AI", () => {
  const result = normalizeAiQuickAddResult(
    "Tej piano Tuesday at 7",
    {
      title: "Piano",
      familyMemberId: "tej",
      familyMemberName: "Tej",
      date: "2026-09-29",
      startTime: null,
      endTime: null,
      allDay: false,
      frequency: "none",
      interval: 1,
      weekdays: [],
      recurrenceEndDate: null,
      location: null,
      notes: null,
      ambiguities: [{ field: "startTime", message: "Is 7 AM or 7 PM?" }],
    },
    { members },
  );

  assert.equal(result.draft.start, null);
  assert.equal(result.draft.end, null);
  assert.equal(result.ambiguities[0].field, "startTime");
  assert.ok(!result.missingFields.includes("startTime"));
});
