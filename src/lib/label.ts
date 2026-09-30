import { z } from 'zod';
import type { Macros } from './types';

/**
 * What Claude transcribes from a nutrition label photo: values exactly as printed for one
 * column (per 100 g/ml when the label has it, else per serving). Conversions happen in
 * `toPer100`, in code, so the model only reads and never does arithmetic.
 */
const n = z.number().nullable();
export const LabelReading = z.object({
  is_nutrition_label: z.boolean().describe('False if the photo does not show a readable nutrition table.'),
  product_name: z.string().nullable().describe('Product name if visible on the photo, else null.'),
  brand: z.string().nullable(),
  basis: z.enum(['per_100g', 'per_100ml', 'per_serving']).describe('Which column the values below come from.'),
  serving_size: n.describe('Serving size number, only when basis is per_serving (e.g. 30 for "30 g").'),
  serving_unit: z.enum(['g', 'ml']).nullable(),
  energy_kcal: n,
  energy_kj: n,
  protein_g: n,
  carbs_g: n.describe('Total carbohydrate as printed.'),
  fat_g: n,
  sugar_g: n,
  fibre_g: n,
  salt_g: n,
  sodium_mg: n.describe('Only if the label lists sodium (e.g. US labels); convert g to mg if printed in g.'),
  notes: z.string().describe('Anything uncertain or unreadable, in one short sentence; empty if none.'),
});
export type LabelReading = z.infer<typeof LabelReading>;

/** Result sent to the browser: per-100 values ready for the new-food form. */
export type ScannedFood = {
  name: string;
  brand: string;
  unit: 'g' | 'ml';
  values: Macros;
  notes: string;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Converts a reading to per 100 g/ml. Returns an error message when that isn't possible. */
export function toPer100(r: LabelReading): ScannedFood | { error: string } {
  if (!r.is_nutrition_label) return { error: 'No nutrition table found in the photo. Try a closer, sharper photo of the label.' };
  let factor = 1;
  let unit: 'g' | 'ml' = r.basis === 'per_100ml' ? 'ml' : 'g';
  if (r.basis === 'per_serving') {
    if (!r.serving_size || r.serving_size <= 0) return { error: 'The label only shows values per serving, and the serving size could not be read.' };
    factor = 100 / r.serving_size;
    unit = r.serving_unit ?? 'g';
  }
  const kcal = r.energy_kcal ?? (r.energy_kj != null ? r.energy_kj / 4.184 : null);
  if (kcal == null) return { error: 'Could not read the calories on the label.' };
  const salt = r.salt_g ?? (r.sodium_mg != null ? (r.sodium_mg / 1000) * 2.5 : 0);
  const scale = (v: number | null) => r2((v ?? 0) * factor);
  return {
    name: r.product_name?.trim() ?? '',
    brand: r.brand?.trim() ?? '',
    unit,
    values: {
      kcal: scale(kcal),
      p: scale(r.protein_g),
      c: scale(r.carbs_g),
      f: scale(r.fat_g),
      sugar: scale(r.sugar_g),
      fibre: scale(r.fibre_g),
      salt: scale(salt),
    },
    notes: r.notes.trim(),
  };
}
