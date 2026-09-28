/** Calories and grams of protein, carbs and fat. */
export type Macros = { kcal: number; p: number; c: number; f: number };

/** One ingredient in a recipe. `grams` is the amount in the whole recipe; macros are per 100 g. */
export type Ingredient = Macros & { name: string; grams: number };

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
  days: Record<string, DayLog>;
  weights: Record<string, WeightEntry>;
};

export const DEFAULT_SETTINGS: Settings = { kcal: 2050, p: 150, c: null, f: null };

export const emptyData = (): AppData => ({
  settings: { ...DEFAULT_SETTINGS },
  recipes: {},
  days: {},
  weights: {},
});
