import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecipePrepReminders,
  generateMealPrepReminder,
} from "./mealPrepReminderService.js";

test("uses the supplied reminder time without recalculating it", () => {
  const result = generateMealPrepReminder({
    recipe_name: "Chana masala",
    prep_step: "Soak chickpeas",
    lead_hours: 8,
    meal_scheduled_time: "2026-09-26T18:00:00.000Z",
    reminder_time: "2026-09-26T09:30:00.000Z",
    current_time: "2026-09-26T08:00:00.000Z",
  });

  assert.deepEqual(result, {
    status: "ok",
    message: "Soak chickpeas for Chana masala — needed by 2026-09-26T09:30:00.000Z for tonight's dinner",
  });
});

test("returns the warning variant when the supplied reminder time has passed", () => {
  const result = generateMealPrepReminder({
    recipe_name: "Chana masala",
    prep_step: "Soak chickpeas",
    lead_hours: 8,
    meal_scheduled_time: "2026-09-26T18:00:00.000Z",
    reminder_time: "2026-09-26T10:00:00.000Z",
    current_time: "2026-09-26T10:00:01.000Z",
  });

  assert.deepEqual(result, {
    status: "too_late",
    message: "Not enough time left to Soak chickpeas for Chana masala before 2026-09-26T18:00:00.000Z — consider swapping this meal.",
  });
});

test("creates a separate reminder for every prep step", () => {
  const results = createRecipePrepReminders(
    {
      name: "Chana masala",
      prepSteps: ["Soak chickpeas", "Defrost sauce"],
      leadHours: 8,
    },
    "2026-09-26T18:00:00.000Z",
    "2026-09-26T08:00:00.000Z",
  );

  assert.equal(results.length, 2);
  assert.match(results[0].message, /^Soak chickpeas/);
  assert.match(results[1].message, /^Defrost sauce/);
});

test("does not invent a missing recipe lead time", () => {
  assert.throws(
    () =>
      createRecipePrepReminders(
        { name: "Chana masala", prepSteps: ["Soak chickpeas"], leadHours: null },
        "2026-09-26T18:00:00.000Z",
        "2026-09-26T08:00:00.000Z",
      ),
    /must provide leadHours/,
  );
});
