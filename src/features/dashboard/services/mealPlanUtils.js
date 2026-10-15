export const MENU_STORAGE_KEY = "family_weekly_menu";

export const MEAL_TYPES = ["Breakfast", "Lunch", "Kaira-Lunch", "Dinner"];
export const MEAL_LABELS = {
  Breakfast: "Breakfast",
  Lunch: "Lunch",
  "Kaira-Lunch": "Child lunch",
  Dinner: "Dinner",
};
export const MEAL_EMOJI = {
  Breakfast: "🍳",
  Lunch: "🍛",
  "Kaira-Lunch": "🥗",
  Dinner: "🍽️",
};

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeMealEntry(value) {
  if (typeof value === "string") {
    return { name: value, scheduledTime: "", recipeId: null };
  }
  return {
    name: value?.name || "",
    scheduledTime: value?.scheduledTime || "",
    recipeId: value?.recipeId || null,
  };
}

export function getMealsForDate(
  date,
  menu = {},
  { children = [], childMealPlansEnabled = false } = {},
) {
  const meals = menu[toDateKey(date)] || {};
  const activeChildren =
    childMealPlansEnabled ? children.filter((member) => member.isChild) : [];
  const standardMeals = MEAL_TYPES.filter((type) => type !== "Kaira-Lunch")
    .map((type) => {
      const entry = normalizeMealEntry(meals[type]);
      return { type, value: entry.name, scheduledTime: entry.scheduledTime };
    })
    .filter((meal) => meal.value.trim());

  const childMeals = activeChildren
    .map((child) => {
      const entry = normalizeMealEntry(meals.childMeals?.[child.uid]);
      return {
        type: `child:${child.uid}`,
        label: `${child.displayName || "Child"} lunch`,
        emoji: MEAL_EMOJI["Kaira-Lunch"],
        value: entry.name,
        scheduledTime: entry.scheduledTime,
      };
    })
    .filter((meal) => meal.value.trim());

  return [...standardMeals, ...childMeals];
}
