import { uid } from './format';
import { MACRO_KEYS } from './macros';
import type { OffFood } from './off';
import type { Food, Macros } from './types';

/**
 * Returns the user's own copy of a picked food. Open Food Facts results are added to
 * the user's list (once per barcode), so the next search finds them instantly.
 */
export function ensureFood(picked: Food | OffFood, foods: Record<string, Food>, save: (f: Food) => void): Food {
  if ('id' in picked) return picked;
  const existing = picked.code ? Object.values(foods).find(f => f.code === picked.code) : undefined;
  if (existing) return existing;
  const food: Food = { ...picked, id: uid('fd'), updatedAt: new Date().toISOString() };
  save(food);
  return food;
}


export const pickMacros = (m: Partial<Macros>): Macros => {
  const out = {} as Macros;
  for (const k of MACRO_KEYS) out[k] = m[k] ?? 0;
  return out;
};
