import type { AppData, DayEntry, DayLog, Macros, Recipe, WeightEntry } from './types';
import { addDays } from './dates';

export const MACRO_KEYS = ['kcal', 'p', 'c', 'f', 'sugar', 'fibre', 'salt'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];
export const MACRO_LABELS: Record<MacroKey, string> = {
  kcal: 'Calories', p: 'Protein', c: 'Carbs', f: 'Fat', sugar: 'Sugar', fibre: 'Fibre', salt: 'Salt',
};
export const zeroMacros = (): Macros => ({ kcal: 0, p: 0, c: 0, f: 0, sugar: 0, fibre: 0, salt: 0 });
const zero = (): Macros & { g: number } => ({ g: 0, ...zeroMacros() });

type IngredientLike = { grams: number | string } & Partial<Record<MacroKey, number | string>>;
const n = (v: number | string | undefined) => {
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
  return scale(t, 1 / s);
}

/** Multiplies grams and every macro by `factor`. */
export function scale<T extends Macros & { g: number }>(m: T, factor: number): Macros & { g: number } {
  const out = { g: m.g * factor, ...zeroMacros() };
  for (const k of MACRO_KEYS) out[k] = n(m[k]) * factor;
  return out;
}

/** Macros for `grams` of a food whose values are per 100 g. */
export function forAmount(per100: Partial<Macros>, grams: number): Macros & { g: number } {
  const out = { g: grams, ...zeroMacros() };
  for (const k of MACRO_KEYS) out[k] = (n(per100[k]) * grams) / 100;
  return out;
}

export function entryInfo(e: DayEntry, recipes: AppData['recipes']) {
  const r = e.recipeId ? recipes[e.recipeId] : undefined;
  const base = r ? perServing(r) : { ...e.snap, g: e.snap.g ?? 0 };
  return {
    name: r ? r.name : e.snap.name || 'Removed meal',
    quick: !e.recipeId,
    gone: !!e.recipeId && !r,
    ...scale(base, e.servings || 0),
  };
}

export function dayTotals(day: DayLog | undefined, recipes: AppData['recipes']): Macros {
  const t = zeroMacros();
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

export function lastUsed(days: AppData['days']) {
  const m: Record<string, string> = {};
  for (const [k, d] of Object.entries(days))
    for (const e of d.entries) if (e.recipeId && (!m[e.recipeId] || m[e.recipeId] < k)) m[e.recipeId] = k;
  return m;
}
