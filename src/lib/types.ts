/**
 * Calories, and grams of protein, carbs, fat, sugar, fibre and salt.
 * Data saved before sugar/fibre/salt existed lacks them; calculations treat missing values as 0.
 */
export type Macros = { kcal: number; p: number; c: number; f: number; sugar: number; fibre: number; salt: number };

/** A food in the user's own list, with values per 100 g (or 100 ml). Picked by name, then only the amount is entered. */
export type Food = Macros & {
  id: string;
  name: string;
  brand?: string;
  unit: 'g' | 'ml';
  /** Barcode when the food came from Open Food Facts. */
  code?: string;
  source: 'off' | 'manual';
  /** Product photo URL from Open Food Facts (about 200 px). */
  image?: string;
  updatedAt: string;
};

/**
 * One ingredient in a meal. `grams` is the amount in the whole meal; macros are per 100 g, copied from the food
 * so a meal stays correct even if the food is deleted.
 */
export type Ingredient = Macros & { name: string; grams: number; foodId?: string; unit?: 'g' | 'ml' };

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: Ingredient[];
  updatedAt: string;
};

/** Per-serving values captured when an entry is added; used if the recipe is later deleted, and for quick adds. */
export type Snapshot = Macros & { name: string; g?: number };

export type DayEntry = {
  id: string;
  /** null for quick adds without a recipe */
  recipeId: string | null;
  servings: number;
  snap: Snapshot;
};

export type DayLog = { date: string; entries: DayEntry[] };

export type WeightEntry = { date: string; am: number | null; pm: number | null };

export type Settings = { kcal: number | null; p: number | null; c: number | null; f: number | null };

export type AppData = {
  settings: Settings;
  recipes: Record<string, Recipe>;
  foods: Record<string, Food>;
  days: Record<string, DayLog>;
  weights: Record<string, WeightEntry>;
};

export const DEFAULT_SETTINGS: Settings = { kcal: 2050, p: 150, c: null, f: null };

export const emptyData = (): AppData => ({
  settings: { ...DEFAULT_SETTINGS },
  recipes: {},
  foods: {},
  days: {},
  weights: {},
});
