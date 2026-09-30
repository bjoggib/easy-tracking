'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { supabase, usingSupabase } from '@/lib/supabase';
import { DEFAULT_SHOWN, type ShownNutrient } from '@/lib/types';
import { NumberField } from './NumberField';

const NUTRIENTS: { key: ShownNutrient; label: string }[] = [
  { key: 'p', label: 'Protein' },
  { key: 'c', label: 'Carbs' },
  { key: 'f', label: 'Fat' },
  { key: 'sugar', label: 'Sugar' },
  { key: 'fibre', label: 'Fibre' },
  { key: 'salt', label: 'Salt' },
];

export function Profile() {
  const { data, setTargets, storageLabel } = useStore();
  const st = data.settings;
  const shown = st.show ?? DEFAULT_SHOWN;
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!usingSupabase) return;
    supabase().auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  // Keep the order of NUTRIENTS so the day page is stable whatever order they were ticked in.
  const toggle = (k: ShownNutrient) =>
    setTargets({ show: NUTRIENTS.map(n => n.key).filter(x => (x === k ? !shown.includes(k) : shown.includes(x))) });

  const goal = (k: 'kcal' | 'p' | 'c' | 'f', label: string, unit: string) => (
    <label className="fld">
      {label}
      <span className={`amt${unit.length > 2 ? ' wide' : ''}`}>
        <NumberField value={st[k]} placeholder="—" onCommit={v => setTargets({ [k]: v })} />
        <span>{unit}</span>
      </span>
    </label>
  );

  return (
    <>
      <h2>Profile</h2>
      {email && <p className="muted" style={{ marginTop: -6 }}>{email}</p>}

      <h3>Daily goals</h3>
      <div className="tgrid">
        {goal('kcal', 'Calories', 'kcal')}
        {goal('p', 'Protein', 'g')}
        {goal('c', 'Carbs', 'g')}
        {goal('f', 'Fat', 'g')}
      </div>

      <h3>Show on the day page</h3>
      <ul className="toggles">
        <li>
          <span>Calories</span>
          <span className="muted">Always</span>
        </li>
        {NUTRIENTS.map(n => (
          <li key={n.key}>
            <label htmlFor={`show-${n.key}`}>{n.label}</label>
            <input id={`show-${n.key}`} type="checkbox" role="switch" className="switch" checked={shown.includes(n.key)} onChange={() => toggle(n.key)} />
          </li>
        ))}
      </ul>

      <h3>Units</h3>
      <span className="seg" role="group" aria-label="Units">
        {(['metric', 'us'] as const).map(u => (
          <button key={u} type="button" aria-pressed={(st.units ?? 'metric') === u} onClick={() => setTargets({ units: u })}>
            {u === 'metric' ? 'Metric (kg, g)' : 'US (lb, oz)'}
          </button>
        ))}
      </span>

      <div className="actions" style={{ marginTop: 40 }}>
        <span className="muted" style={{ fontSize: '.85rem' }}>{storageLabel}</span>
        <span className="spacer" />
        {usingSupabase && <button type="button" className="btn" onClick={() => supabase().auth.signOut()}>Sign out</button>}
      </div>
    </>
  );
}
