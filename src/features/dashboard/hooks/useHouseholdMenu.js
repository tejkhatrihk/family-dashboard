import { useCallback, useEffect, useRef, useState } from "react";
import { useHousehold } from "../../household/api/householdContext";
import {
  migrateLocalMenu,
  normalizeMealEntry,
  setHouseholdChildMeal,
  setHouseholdMeal,
  subscribeToHouseholdMenu,
  toDateKey,
} from "../services/mealService";

export function useHouseholdMenu() {
  const { householdId } = useHousehold();
  const [menu, setMenu] = useState({});
  const [loading, setLoading] = useState(Boolean(householdId));
  const migrationAttempted = useRef(false);

  useEffect(() => {
    if (!householdId) return undefined;
    return subscribeToHouseholdMenu(
      householdId,
      (nextMenu) => {
        setMenu(nextMenu);
        setLoading(false);
        if (!Object.keys(nextMenu).length && !migrationAttempted.current) {
          migrationAttempted.current = true;
          migrateLocalMenu(householdId).catch(console.error);
        }
      },
      (error) => {
        console.error("Failed to load household menu:", error);
        setLoading(false);
      },
    );
  }, [householdId]);

  const setMeal = useCallback(
    (date, mealType, value) => {
      const dateKey = toDateKey(date);
      setMenu((previous) => ({
        ...previous,
        [dateKey]: { ...previous[dateKey], [mealType]: value },
      }));
      return setHouseholdMeal(householdId, date, mealType, value);
    },
    [householdId],
  );

  const setChildMeal = useCallback(
    (date, childId, value) => {
      const dateKey = toDateKey(date);
      const entry = normalizeMealEntry(value);
      setMenu((previous) => {
        const childMeals = { ...previous[dateKey]?.childMeals };
        if (entry.name.trim()) childMeals[childId] = entry;
        else delete childMeals[childId];
        return {
          ...previous,
          [dateKey]: {
            ...previous[dateKey],
            childMeals,
          },
        };
      });
      return setHouseholdChildMeal(householdId, date, childId, entry);
    },
    [householdId],
  );

  return { menu, loading, setMeal, setChildMeal };
}
