import type { AppData, DayEntry, DayLog, Ingredient, Macros, Recipe, WeightEntry } from './types';
import { addDays } from './dates';

export const MACRO_KEYS = ['kcal', 'p', 'c', 'f'] as const;
const zero = (): Macros & { g: number } => ({ g: 0, kcal: 0, p: 0, c: 0, f: 0 });

type IngredientLike = { grams: number | string; kcal: number | string; p: number | string; c: number | string; f: number | string };
const n = (v: number | string) => {
  const x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};

export function recipeTotals(ingredients: IngredientLike[]) {
  const t = zero();
  for (const i of ingredients) {
    const g = n(i.grams);
    t.g += g;
    for (const k of MACRO_KEYS) t[k] += (g * n(i[k])) / 100;
  }
  return t;
}

export function perServing(r: Pick<Recipe, 'ingredients' | 'servings'>) {
  const t = recipeTotals(r.ingredients);
  const s = r.servings > 0 ? r.servings : 1;
  return { g: t.g / s, kcal: t.kcal / s, p: t.p / s, c: t.c / s, f: t.f / s };
}

export function entryInfo(e: DayEntry, recipes: AppData['recipes']) {
  const r = e.recipeId ? recipes[e.recipeId] : undefined;
  const base = r ? perServing(r) : { g: e.snap.g ?? 0, kcal: e.snap.kcal, p: e.snap.p, c: e.snap.c, f: e.snap.f };
  const s = e.servings || 0;
  return {
    name: r ? r.name : e.snap.name || 'Removed recipe',
    quick: !e.recipeId,
    gone: !!e.recipeId && !r,
    g: base.g * s,
    kcal: base.kcal * s,
    p: base.p * s,
    c: base.c * s,
    f: base.f * s,
  };
}

export function dayTotals(day: DayLog | undefined, recipes: AppData['recipes']): Macros {
  const t: Macros = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const e of day?.entries ?? []) {
    const m = entryInfo(e, recipes);
    for (const k of MACRO_KEYS) t[k] += m[k];
  }
  return t;
}

export function dailyAvg(weights: Record<string, WeightEntry>, k: string): number | null {
  const w = weights[k];
  if (!w) return null;
  const v = [w.am, w.pm].filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Mean of the daily averages in the 7 calendar days ending on k; days without readings are skipped. */
export function rolling(weights: Record<string, WeightEntry>, k: string) {
  let s = 0, count = 0;
  for (let i = 0; i < 7; i++) {
    const a = dailyAvg(weights, addDays(k, -i));
    if (a != null) { s += a; count++; }
  }
  return count ? { avg: s / count, n: count } : null;
}

export function knownIngredients(recipes: AppData['recipes']) {
  const m: Record<string, Ingredient> = {};
  for (const r of Object.values(recipes)) for (const i of r.ingredients) if (i.name) m[i.name.trim().toLowerCase()] = i;
  return m;
}

export function lastUsed(days: AppData['days']) {
  const m: Record<string, string> = {};
  for (const [k, d] of Object.entries(days))
    for (const e of d.entries) if (e.recipeId && (!m[e.recipeId] || m[e.recipeId] < k)) m[e.recipeId] = k;
  return m;
}
