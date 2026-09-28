/** Parse user input, accepting a comma as the decimal separator. */
export const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const r0 = (n: number | null | undefined) => Math.round(n || 0).toLocaleString('en-GB');
export const r1 = (n: number | null | undefined) =>
  (Math.round((n || 0) * 10) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 });
export const kg = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2));
export const signed = (v: number, digits: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(digits);
export const uid = (prefix: string) =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
