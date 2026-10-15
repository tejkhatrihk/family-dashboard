import assert from "node:assert/strict";
import test from "node:test";
import { parseQuickAdd } from "./quickAddParser.js";

const members = [
  { id: "tej", name: "Tej" },
  { id: "kaira", name: "Kaira" },
  { id: "hanish", name: "Hanish" },
];
const mondayMorning = new Date(2026, 8, 28, 9, 0, 0, 0);

test("parses a weekly event for a known family member", () => {
  const result = parseQuickAdd("Kaira has swimming every Monday at 7 PM until December 14", {
    members,
    now: mondayMorning,
  });

  assert.equal(result.draft.title, "Swimming");
  assert.equal(result.draft.ownerId, "kaira");
  assert.equal(result.draft.start.getFullYear(), 2026);
  assert.equal(result.draft.start.getMonth(), 8);
  assert.equal(result.draft.start.getDate(), 28);
  assert.equal(result.draft.start.getHours(), 19);
  assert.equal(result.draft.recurrence.frequency, "weekly");
  assert.deepEqual(result.draft.recurrence.weekdays, ["MO"]);
  assert.equal(result.draft.recurrence.until, "2026-12-14");
  assert.ok(result.missingFields.includes("endTime"));
});

test("parses next weekday, explicit time range, location, and notes", () => {
  const result = parseQuickAdd(
    "Hanish has a dentist appointment next Thursday from 3:30 PM to 4:30 PM location: Maple Clinic notes: bring insurance card",
    { members, now: mondayMorning },
  );

  assert.equal(result.draft.title, "Dentist appointment");
  assert.equal(result.draft.ownerId, "hanish");
  assert.equal(result.draft.start.getDay(), 4);
  assert.equal(result.draft.start.getHours(), 15);
  assert.equal(result.draft.end.getHours(), 16);
  assert.equal(result.draft.location, "Maple Clinic");
  assert.equal(result.draft.description, "bring insurance card");
  assert.deepEqual(result.missingFields, []);
});

test("does not invent AM or PM for an ambiguous time", () => {
  const result = parseQuickAdd("Kaira piano Wednesday at 7:30", {
    members,
    now: mondayMorning,
  });

  assert.equal(result.draft.title, "Piano");
  assert.equal(result.draft.start, null);
  assert.equal(result.ambiguities[0].field, "startTime");
  assert.equal(result.needsAi, true);
});

test("uses an anytime event when a date is known but no time was supplied", () => {
  const result = parseQuickAdd("Swimming every Monday", {
    members,
    now: mondayMorning,
  });

  assert.equal(result.draft.owner, "");
  assert.equal(result.draft.allDay, true);
  assert.equal(result.draft.start.getDate(), 28);
  assert.equal(result.draft.end.getDate(), 29);
  assert.ok(result.missingFields.includes("familyMember"));
  assert.ok(!result.missingFields.includes("startTime"));
  assert.ok(!result.missingFields.includes("endTime"));
});

test("uses the parsed date as an anytime event when only a vague time was supplied", () => {
  const result = parseQuickAdd(
    "Tej has to clean bathrooms every Tuesday evening",
    { members, now: mondayMorning },
  );

  assert.equal(result.draft.title, "Clean bathrooms");
  assert.equal(result.draft.ownerId, "tej");
  assert.equal(result.draft.allDay, true);
  assert.equal(result.draft.start.getDate(), 29);
  assert.equal(result.draft.end.getDate(), 30);
  assert.equal(result.parsed.date, "2026-09-29");
  assert.equal(result.parsed.startTime, null);
  assert.equal(result.draft.recurrence.frequency, "weekly");
  assert.deepEqual(result.draft.recurrence.weekdays, ["TU"]);
  assert.deepEqual(result.ambiguities, []);
  assert.ok(result.warnings.some((warning) => warning.includes("Anytime")));
  assert.ok(!result.missingFields.includes("startTime"));
  assert.ok(!result.missingFields.includes("endTime"));
});

test("uses an explicit duration to calculate the end", () => {
  const result = parseQuickAdd("Kaira swimming tomorrow at 7 PM for 90 minutes", {
    members,
    now: mondayMorning,
  });

  assert.equal(result.draft.start.getHours(), 19);
  assert.equal(result.draft.end.getHours(), 20);
  assert.equal(result.draft.end.getMinutes(), 30);
  assert.ok(!result.missingFields.includes("endTime"));
});

test("parses a weekday range as a weekly recurrence", () => {
  const sundayMorning = new Date(2026, 9, 11, 9, 0, 0, 0);
  const result = parseQuickAdd(
    "Tej woks from 9 am to 5 pm from Monday to Friday",
    { members, now: sundayMorning },
  );

  assert.equal(result.draft.title, "Woks");
  assert.equal(result.draft.ownerId, "tej");
  assert.equal(result.parsed.date, "2026-10-12");
  assert.equal(result.draft.start.getHours(), 9);
  assert.equal(result.draft.end.getHours(), 17);
  assert.equal(result.draft.recurrence.frequency, "weekly");
  assert.deepEqual(result.draft.recurrence.weekdays, ["MO", "TU", "WE", "TH", "FR"]);
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.needsAi, false);
});
