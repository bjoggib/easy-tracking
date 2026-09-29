'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { r0, r1 } from '@/lib/format';
import type { OffFood } from '@/lib/off';
import type { Food } from '@/lib/types';

export type Picked = Food | OffFood;

type Props = {
  value: string;
  onText: (text: string) => void;
  onPick: (food: Picked) => void;
  /** Offered at the end of the list, to enter a food's values by hand. */
  onManual?: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
};

type Option = { key: string; food?: Picked; manual?: string };

const cache = new Map<string, OffFood[]>();

export const foodLabel = (f: { name: string; brand?: string }) => (f.brand ? `${f.name} · ${f.brand}` : f.name);

/**
 * Search box for foods: the user's own foods first, then Open Food Facts (via /api/off).
 * Typing a barcode number looks up that product.
 */
export function FoodPicker({ value, onText, onPick, onManual, placeholder = 'Search foods or scan a barcode number', autoFocus, label }: Props) {
  const { data } = useStore();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [off, setOff] = useState<{ q: string; foods: OffFood[] } | null>(null);
  const [status, setStatus] = useState<{ q: string; msg: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const q = value.trim();
  const needle = q.toLowerCase();

  const mine = useMemo(() => {
    const words = needle.split(/\s+/).filter(Boolean);
    return Object.values(data.foods)
      .filter(f => words.every(w => foodLabel(f).toLowerCase().includes(w)))
      .sort((a, b) => (needle ? a.name.length - b.name.length : b.updatedAt.localeCompare(a.updatedAt)))
      .slice(0, needle ? 8 : 6);
  }, [data.foods, needle]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!open || q.length < 3) return;
    if (cache.has(needle)) return setOff({ q: needle, foods: cache.get(needle)! });
    setStatus({ q: needle, msg: 'Searching Open Food Facts…' });
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/off?q=${encodeURIComponent(q)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Search failed.');
        cache.set(needle, body.foods);
        setOff({ q: needle, foods: body.foods });
        setStatus(null);
      } catch (err) {
        setStatus({ q: needle, msg: err instanceof Error ? err.message : 'Search failed.' });
      }
    }, 450);
    return () => clearTimeout(timer.current);
  }, [q, needle, open]);

  const myCodes = new Set(Object.values(data.foods).map(f => f.code).filter(Boolean));
  const offFoods = off?.q === needle ? off.foods.filter(f => !f.code || !myCodes.has(f.code)) : [];
  const offStatus = status?.q === needle ? status.msg : null;

  const options: Option[] = [
    ...mine.map(f => ({ key: f.id, food: f })),
    ...offFoods.map((f, i) => ({ key: `off${i}`, food: f })),
    ...(onManual && q ? [{ key: 'manual', manual: q }] : []),
  ];
  const choose = (o: Option | undefined) => {
    if (!o) return;
    if (o.food) onPick(o.food);
    else if (o.manual != null) onManual?.(o.manual);
    setOpen(false);
  };

  const row = (o: Option, i: number) => {
    const f = o.food;
    return (
      <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
        <button type="button" tabIndex={-1} className={i === active ? 'on' : undefined} onMouseEnter={() => setActive(i)} onClick={() => choose(o)}>
          {f ? (
            <>
              <span>{foodLabel(f)}</span>
              <span className="pm">{r0(f.kcal)} kcal, {r1(f.p)} g protein /100 {f.unit}</span>
            </>
          ) : (
            <span>Enter “{o.manual}” by hand</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="fpick" onMouseDown={e => { if ((e.target as HTMLElement).closest('.fdrop')) e.preventDefault(); }}>
      <input
        className="txt"
        type="search"
        role="combobox"
        aria-label={label ?? 'Food'}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={e => { onText(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, options.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open) { e.preventDefault(); choose(options[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (options.length > 0 || offStatus) && (
        <div className="fdrop">
          <ul id={listId} role="listbox" aria-label="Matching foods">
            {mine.length > 0 && <li className="fhead" role="presentation">Your foods</li>}
            {options.slice(0, mine.length).map((o, i) => row(o, i))}
            {(offFoods.length > 0 || offStatus) && <li className="fhead" role="presentation">Open Food Facts</li>}
            {offStatus && <li className="fnote" role="presentation">{offStatus}</li>}
            {!offStatus && off?.q === needle && !offFoods.length && q.length >= 3 && (
              <li className="fnote" role="presentation">No products with nutrition values found.</li>
            )}
            {options.slice(mine.length).map((o, i) => row(o, i + mine.length))}
          </ul>
        </div>
      )}
    </div>
  );
}
