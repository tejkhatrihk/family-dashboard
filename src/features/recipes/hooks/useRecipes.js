import { useCallback, useEffect, useRef, useState } from 'react';
import { useGoogleAuth } from '../../../shared/api/googleAuthContext';
import { loadFromDrive, saveToDrive } from '../services/googleDriveRecipeService';

const LOCAL_KEY = 'family_recipes';

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; }
  catch { return []; }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Hook that exposes recipe list state and CRUD helpers.
 * Persists to Google Drive when signed in; falls back to localStorage otherwise.
 * Automatically migrates existing localStorage recipes to Drive on first sign-in.
 */
export function useRecipes() {
  const { accessToken, isSignedIn } = useGoogleAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stable refs so callbacks stay referentially stable across token/sign-in changes
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const signedInRef = useRef(isSignedIn);
  signedInRef.current = isSignedIn;
  const recipesRef = useRef(recipes);
  recipesRef.current = recipes;

  // Load recipes whenever sign-in state changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      if (!isSignedIn) {
        if (!cancelled) { setRecipes(readLocal()); setLoading(false); }
        return;
      }

      try {
        let data = await loadFromDrive(accessToken);
        if (cancelled) return;

        if (data === null) {
          // First sign-in — migrate any localStorage recipes up to Drive
          const local = readLocal();
          if (local.length > 0) await saveToDrive(accessToken, local);
          data = local;
        }

        setRecipes(data);
      } catch (err) {
        console.error('Failed to load recipes from Drive, using localStorage:', err);
        if (!cancelled) setRecipes(readLocal());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [accessToken, isSignedIn]);

  /** Write updated recipe list to state + backing store (optimistic). */
  const persist = useCallback((updated) => {
    setRecipes(updated);
    if (signedInRef.current) {
      saveToDrive(tokenRef.current, updated).catch(console.error);
    } else {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    }
  }, []);

  const save = useCallback((recipe) => {
    const now = new Date().toISOString();
    const prev = recipesRef.current;

    let updated;
    if (recipe.id) {
      const idx = prev.findIndex((r) => r.id === recipe.id);
      const saved = { ...recipe, updatedAt: now };
      updated = idx >= 0
        ? [...prev.slice(0, idx), saved, ...prev.slice(idx + 1)]
        : [...prev, saved];
    } else {
      updated = [...prev, { ...recipe, id: generateId(), createdAt: now, updatedAt: now }];
    }

    persist(updated);
  }, [persist]);

  const remove = useCallback((id) => {
    persist(recipesRef.current.filter((r) => r.id !== id));
  }, [persist]);

  const refresh = useCallback(async () => {
    if (signedInRef.current) {
      try {
        const data = await loadFromDrive(tokenRef.current);
        setRecipes(data ?? []);
      } catch (err) {
        console.error('Refresh failed:', err);
      }
    } else {
      setRecipes(readLocal());
    }
  }, []);

  return { recipes, loading, save, remove, refresh };
}
