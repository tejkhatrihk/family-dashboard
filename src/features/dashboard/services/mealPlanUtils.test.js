import assert from "node:assert/strict";
import test from "node:test";
import { getMealsForDate } from "./mealPlanUtils.js";

const date = new Date(2026, 9, 15);
const dateKey = "2026-10-15";
const children = [
  { uid: "child-a", displayName: "Asha", isChild: true },
  { uid: "member-b", displayName: "Ravi", isChild: false },
  { uid: "child-c", displayName: "Mira", isChild: true },
];

test("does not show a generic child lunch when child plans are disabled", () => {
  const meals = getMealsForDate(
    date,
    {
      [dateKey]: {
        "Kaira-Lunch": { name: "Vegetable wrap" },
        childMeals: { "child-a": { name: "Dosa" } },
      },
    },
    { children, childMealPlansEnabled: false },
  );

  assert.deepEqual(meals, []);
});

test("shows a separate named lunch for each child and hides the legacy lunch", () => {
  const meals = getMealsForDate(
    date,
    {
      [dateKey]: {
        Breakfast: { name: "Toast" },
        "Kaira-Lunch": { name: "Legacy lunch" },
        Dinner: { name: "Pasta" },
        childMeals: {
          "child-a": { name: "Dosa" },
          "child-c": { name: "Rice and lentils" },
          "member-b": { name: "Not a child's meal" },
        },
      },
    },
    { children, childMealPlansEnabled: true },
  );

  assert.deepEqual(
    meals.map(({ type, label, value }) => ({ type, label, value })),
    [
      { type: "Breakfast", label: undefined, value: "Toast" },
      { type: "Dinner", label: undefined, value: "Pasta" },
      { type: "child:child-a", label: "Asha lunch", value: "Dosa" },
      {
        type: "child:child-c",
        label: "Mira lunch",
        value: "Rice and lentils",
      },
    ],
  );
});

test("does not show the generic child lunch when no child profiles are enabled", () => {
  const meals = getMealsForDate(
    date,
    { [dateKey]: { "Kaira-Lunch": { name: "Sandwich" } } },
    { children: [], childMealPlansEnabled: true },
  );

  assert.deepEqual(meals, []);
});
