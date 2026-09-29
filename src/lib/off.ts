import type { Food } from './types';

/** A food found on Open Food Facts, not yet in the user's list. Values per 100 g (or 100 ml). */
export type OffFood = Omit<Food, 'id' | 'updatedAt'>;

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string | string[];
  quantity?: string;
  nutriments?: Record<string, number | string | undefined>;
};

export const OFF_FIELDS = 'code,product_name,product_name_en,brands,quantity,nutriments';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Normalises an Open Food Facts product; null when it has no name or no calories per 100 g. */
export function fromOff(p: OffProduct): OffFood | null {
  const n = p.nutriments ?? {};
  const get = (k: string) => {
    const v = Number(n[`${k}_100g`]);
    return Number.isFinite(v) && v >= 0 ? r2(v) : null;
  };
  const kcal = get('energy-kcal') ?? (get('energy') != null ? r2(get('energy')! / 4.184) : null);
  const name = (p.product_name_en || p.product_name || '').trim();
  if (!name || kcal == null) return null;
  const brand = (Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0])?.trim();
  const sodium = get('sodium');
  return {
    name,
    ...(brand ? { brand } : {}),
    unit: /\d\s*(ml|cl|l)\b/i.test(p.quantity ?? '') ? 'ml' : 'g',
    ...(p.code ? { code: p.code } : {}),
    source: 'off',
    kcal,
    p: get('proteins') ?? 0,
    c: get('carbohydrates') ?? 0,
    f: get('fat') ?? 0,
    sugar: get('sugars') ?? 0,
    fibre: get('fiber') ?? 0,
    salt: get('salt') ?? (sodium != null ? r2(sodium * 2.5) : 0),
  };
}
