const pad = (n: number) => String(n).padStart(2, '0');

export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const isDateKey = (k: unknown): k is string =>
  typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(parseKey(k).getTime());
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
export const todayKey = () => keyOf(new Date());
export const daysBetween = (a: string, b: string) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 864e5);
/** Monday of the week containing k. */
export const weekStart = (k: string) => {
  const d = parseKey(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return keyOf(d);
};

const fmt = (k: string, o: Intl.DateTimeFormatOptions) => parseKey(k).toLocaleDateString('en-GB', o);
export const fmtLong = (k: string) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtShort = (k: string) => fmt(k, { day: 'numeric', month: 'short' });
export const fmtRow = (k: string) => fmt(k, { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtWeekday = (k: string) => fmt(k, { weekday: 'short' });
export const fmtWeekRange = (start: string) => {
  const end = addDays(start, 6);
  const a = parseKey(start), b = parseKey(end);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${fmt(end, { day: 'numeric', month: 'long' })}`
    : `${fmtShort(start)} – ${fmtShort(end)}`;
};
