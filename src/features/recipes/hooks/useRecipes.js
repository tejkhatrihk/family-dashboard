import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHousehold } from "../../household/api/householdContext";
import { firestore } from "../../../shared/api/firebaseClient";

const LOCAL_KEY = "family_recipes";

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

export function useRecipes() {
  const { householdId } = useHousehold();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const migrationAttempted = useRef(false);

  useEffect(() => {
    if (!householdId) return undefined;
    const recipesCollection = collection(
      firestore,
      "households",
      householdId,
      "recipes",
    );
    return onSnapshot(
      recipesCollection,
      (snapshot) => {
        const sharedRecipes = snapshot.docs.map((recipe) => ({
          id: recipe.id,
          ...recipe.data(),
        }));
        setRecipes(sharedRecipes);
        setLoading(false);

        if (!sharedRecipes.length && !migrationAttempted.current) {
          migrationAttempted.current = true;
          const localRecipes = readLocal();
          Promise.all(
            localRecipes.map((recipe) => {
              const recipeRef = recipe.id
                ? doc(recipesCollection, recipe.id)
                : doc(recipesCollection);
              return setDoc(recipeRef, {
                ...recipe,
                migratedAt: serverTimestamp(),
              });
            }),
          ).catch(console.error);
        }
      },
      (error) => {
        console.error("Failed to load household recipes:", error);
        setLoading(false);
      },
    );
  }, [householdId]);

  const save = useCallback(
    (recipe) => {
      const recipesCollection = collection(
        firestore,
        "households",
        householdId,
        "recipes",
      );
      const recipeRef = recipe.id
        ? doc(recipesCollection, recipe.id)
        : doc(recipesCollection);
      const now = new Date().toISOString();
      const saved = {
        ...recipe,
        id: recipeRef.id,
        updatedAt: now,
        ...(!recipe.id && { createdAt: now }),
      };
      setRecipes((previous) => {
        const exists = previous.some((item) => item.id === saved.id);
        return exists
          ? previous.map((item) => (item.id === saved.id ? saved : item))
          : [...previous, saved];
      });
      return setDoc(recipeRef, saved, { merge: true });
    },
    [householdId],
  );

  const remove = useCallback(
    (id) => {
      setRecipes((previous) => previous.filter((recipe) => recipe.id !== id));
      return deleteDoc(
        doc(firestore, "households", householdId, "recipes", id),
      );
    },
    [householdId],
  );

  const refresh = useCallback(async () => {
    const snapshot = await getDocs(
      collection(firestore, "households", householdId, "recipes"),
    );
    setRecipes(
      snapshot.docs.map((recipe) => ({ id: recipe.id, ...recipe.data() })),
    );
  }, [householdId]);

  return { recipes, loading, save, remove, refresh };
}
