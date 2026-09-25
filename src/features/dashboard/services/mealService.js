import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { firestore } from "../../../shared/api/firebaseClient";

export const MENU_STORAGE_KEY = "family_weekly_menu";

export const MEAL_TYPES = ["Breakfast", "Lunch", "Kaira-Lunch", "Dinner"];
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

export function loadMenu() {
  try {
    return JSON.parse(localStorage.getItem(MENU_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function getMealsForDate(date, menu = loadMenu()) {
  const meals = menu[toDateKey(date)] || {};
  return MEAL_TYPES.map((type) => ({ type, value: meals[type] || "" })).filter(
    (meal) => meal.value.trim(),
  );
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
  await setDoc(
    doc(firestore, "households", householdId, "menus", toDateKey(date)),
    {
      [mealType]: value.trim() ? value : deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function migrateLocalMenu(householdId) {
  const localMenu = loadMenu();
  await Promise.all(
    Object.entries(localMenu).map(([dateKey, meals]) =>
      setDoc(
        doc(firestore, "households", householdId, "menus", dateKey),
        { ...meals, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    ),
  );
}
