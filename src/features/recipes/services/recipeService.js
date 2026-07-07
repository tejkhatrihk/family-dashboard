const STORAGE_KEY = 'family_recipes';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Return all saved recipes. */
export function getRecipes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/** Return a single recipe by id, or null. */
export function getRecipeById(id) {
  return getRecipes().find((r) => r.id === id) ?? null;
}

/**
 * Create or update a recipe.
 * Pass a recipe without an `id` to create; include `id` to update.
 * Returns the persisted recipe.
 */
export function saveRecipe(recipe) {
  const recipes = getRecipes();
  const now = new Date().toISOString();

  if (recipe.id) {
    const idx = recipes.findIndex((r) => r.id === recipe.id);
    const updated = { ...recipe, updatedAt: now };
    if (idx >= 0) {
      recipes[idx] = updated;
    } else {
      recipes.push(updated);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
    return updated;
  }

  const created = { ...recipe, id: generateId(), createdAt: now, updatedAt: now };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...recipes, created]));
  return created;
}

/** Remove a recipe by id. */
export function deleteRecipe(id) {
  const recipes = getRecipes().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}
