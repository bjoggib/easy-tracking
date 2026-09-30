'use client';

import { useMemo } from 'react';
import { r0, r1 } from './format';
import { useStore } from './store';

/**
 * Display units. Data is always stored metric (kg, g, ml); these helpers convert at the edges.
 * Nutrients (protein, carbs, …) stay in grams in both systems, as on US labels.
 */
export type UnitSystem = 'metric' | 'us';

const G_PER_OZ = 28.349523125;
const ML_PER_FL_OZ = 29.5735295625;
const KG_PER_LB = 0.45359237;

export function unitsFor(system: UnitSystem) {
  const us = system === 'us';
  const perUnit = (base: 'g' | 'ml') => (base === 'ml' ? ML_PER_FL_OZ : G_PER_OZ);
  return {
    system,
    /** Body weight unit label. */
    body: us ? 'lb' : 'kg',
    bodyOut: (kg: number) => (us ? kg / KG_PER_LB : kg),
    bodyIn: (v: number) => (us ? v * KG_PER_LB : v),
    /** Body weight as text, from kg; "—" when missing. */
    fmtBody: (kg: number | null | undefined) => (kg == null ? '—' : us ? (kg / KG_PER_LB).toFixed(1) : kg.toFixed(2)),
    /** Decimals used for body weight in this system. */
    bodyDigits: us ? 1 : 2,
    /** Amount unit label for a food measured in g or ml. */
    amountUnit: (base: 'g' | 'ml' = 'g') => (us ? (base === 'ml' ? 'fl oz' : 'oz') : base),
    /** Stored grams/ml → the number shown. */
    amountOut: (grams: number, base: 'g' | 'ml' = 'g') => (us ? grams / perUnit(base) : grams),
    /** Number typed by the user → grams/ml to store. */
    amountIn: (v: number, base: 'g' | 'ml' = 'g') => (us ? v * perUnit(base) : v),
    /** Amount as text with unit, from grams/ml. */
    fmtAmount: (grams: number, base: 'g' | 'ml' = 'g') =>
      us ? `${r1(grams / perUnit(base))} ${base === 'ml' ? 'fl oz' : 'oz'}` : `${r0(grams)} ${base}`,
    /** Amount for an input field: whole grams, or ounces to 2 decimals. */
    amountField: (grams: number, base: 'g' | 'ml' = 'g') =>
      us ? String(Math.round((grams / perUnit(base)) * 100) / 100) : String(Math.round(grams * 100) / 100),
    /** Default amount for the food calculator: 100 g, or 1 oz. */
    defaultAmount: us ? '1' : '100',
  };
}

export type Units = ReturnType<typeof unitsFor>;

/** The signed-in user's unit preference (metric unless they chose US). */
export function useUnits(): Units {
  const { data } = useStore();
  const system = data.settings.units ?? 'metric';
  return useMemo(() => unitsFor(system), [system]);
}
