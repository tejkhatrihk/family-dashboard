import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { firestore } from "../../../shared/api/firebaseClient";
import {
  getMealsForDate as getMealsFromMenu,
  MENU_STORAGE_KEY,
  MEAL_EMOJI,
  MEAL_LABELS,
  MEAL_TYPES,
  normalizeMealEntry,
  toDateKey,
} from "./mealPlanUtils.js";

export {
  MENU_STORAGE_KEY,
  MEAL_EMOJI,
  MEAL_LABELS,
  MEAL_TYPES,
  normalizeMealEntry,
  toDateKey,
};

export function loadMenu() {
  try {
    return JSON.parse(localStorage.getItem(MENU_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function getMealsForDate(date, menu = loadMenu(), options) {
  return getMealsFromMenu(date, menu, options);
}

export function subscribeToHouseholdMenu(householdId, onValue, onError) {
  return onSnapshot(
    collection(firestore, "households", householdId, "menus"),
    (snapshot) => {
      const menu = Object.fromEntries(
        snapshot.docs.map((menuDay) => [menuDay.id, menuDay.data()]),
      );
      onValue(menu);
    },
    onError,
  );
}

export async function setHouseholdMeal(householdId, date, mealType, value) {
  const entry = normalizeMealEntry(value);
  await setDoc(
    doc(firestore, "households", householdId, "menus", toDateKey(date)),
    {
      [mealType]: entry.name.trim() ? entry : deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function setHouseholdChildMeal(
  householdId,
  date,
  childId,
  value,
) {
  const entry = normalizeMealEntry(value);
  await setDoc(
    doc(firestore, "households", householdId, "menus", toDateKey(date)),
    {
      childMeals: {
        [childId]: entry.name.trim() ? entry : deleteField(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function migrateLocalMenu(householdId, existingMenu = {}) {
  const localMenu = loadMenu();
  await Promise.all(
    Object.entries(localMenu).map(([dateKey, meals]) => {
      const currentMeals = existingMenu[dateKey] || {};
      const missingMeals = {};
      for (const [mealType, entry] of Object.entries(meals)) {
        if (mealType === "childMeals" && entry && typeof entry === "object") {
          const missingChildMeals = Object.fromEntries(
            Object.entries(entry).filter(
              ([childId]) =>
                !Object.hasOwn(currentMeals.childMeals || {}, childId),
            ),
          );
          if (Object.keys(missingChildMeals).length) {
            missingMeals.childMeals = missingChildMeals;
          }
        } else if (!Object.hasOwn(currentMeals, mealType)) {
          missingMeals[mealType] = entry;
        }
      }

      return Object.keys(missingMeals).length
        ? setDoc(
            doc(firestore, "households", householdId, "menus", dateKey),
            { ...missingMeals, updatedAt: serverTimestamp() },
            { merge: true },
          )
        : Promise.resolve();
    }),
  );
  localStorage.removeItem(MENU_STORAGE_KEY);
}
