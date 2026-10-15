const REQUIRED_TEXT_FIELDS = [
  "recipe_name",
  "prep_step",
  "meal_scheduled_time",
  "reminder_time",
  "current_time",
];

function requireValidInput(input) {
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (typeof input[field] !== "string" || !input[field].trim()) {
      throw new TypeError(`${field} is required.`);
    }
  }

  if (!Number.isFinite(input.lead_hours) || input.lead_hours < 0) {
    throw new TypeError("lead_hours must be a non-negative number.");
  }

  for (const field of ["meal_scheduled_time", "reminder_time", "current_time"]) {
    if (Number.isNaN(new Date(input[field]).getTime())) {
      throw new TypeError(`${field} must be a valid ISO datetime.`);
    }
  }
}

/** Formats one prep reminder without calculating or modifying its timing. */
export function generateMealPrepReminder(input) {
  requireValidInput(input);

  const {
    recipe_name: recipeName,
    prep_step: prepStep,
    meal_scheduled_time: mealScheduledTime,
    reminder_time: reminderTime,
    current_time: currentTime,
  } = input;
  const isTooLate =
    new Date(reminderTime).getTime() < new Date(currentTime).getTime();

  if (isTooLate) {
    return {
      status: "too_late",
      message: `Not enough time left to ${prepStep} for ${recipeName} before ${mealScheduledTime} — consider swapping this meal.`,
    };
  }

  return {
    status: "ok",
    message: `${prepStep} for ${recipeName} — needed by ${reminderTime} for tonight's dinner`,
  };
}

/** App-level timing calculation, deliberately separate from message generation. */
export function calculateMealPrepReminderTime(mealScheduledTime, leadHours) {
  const mealTime = new Date(mealScheduledTime);
  if (Number.isNaN(mealTime.getTime())) {
    throw new TypeError("mealScheduledTime must be a valid ISO datetime.");
  }
  if (!Number.isFinite(leadHours) || leadHours < 0) {
    throw new TypeError("leadHours must be a non-negative number.");
  }

  return new Date(mealTime.getTime() - leadHours * 60 * 60 * 1000).toISOString();
}

/** Creates one independent reminder result for each stored recipe prep step. */
export function createRecipePrepReminders(recipe, mealScheduledTime, currentTime) {
  if (
    recipe.leadHours == null ||
    recipe.leadHours === "" ||
    !Number.isFinite(Number(recipe.leadHours))
  ) {
    throw new TypeError("The recipe must provide leadHours.");
  }
  const leadHours = Number(recipe.leadHours);
  const reminderTime = calculateMealPrepReminderTime(mealScheduledTime, leadHours);

  return (recipe.prepSteps || [])
    .filter((step) => typeof step === "string")
    .map((step) => step.trim())
    .filter(Boolean)
    .map((prepStep) =>
      generateMealPrepReminder({
        recipe_name: recipe.name,
        prep_step: prepStep,
        lead_hours: leadHours,
        meal_scheduled_time: mealScheduledTime,
        reminder_time: reminderTime,
        current_time: currentTime,
      }),
    );
}
