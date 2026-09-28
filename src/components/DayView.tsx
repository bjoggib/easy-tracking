'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { addDays, fmtLong, todayKey } from '@/lib/dates';
import { num, r0, r1, uid } from '@/lib/format';
import { dayTotals, entryInfo, lastUsed, perServing } from '@/lib/macros';
import type { DayEntry, Recipe, Settings } from '@/lib/types';
import { NumberField } from './NumberField';

function MacroRow({ label, color, value, target }: { label: string; color: string; value: number; target: number | null }) {
  return (
    <div className="mrow" style={{ ['--m' as string]: `var(${color})` }}>
      <span className="nm">{label}</span>
      <span className="v">
        <b>{r0(value)}</b> <span className="muted">{target ? `/ ${r0(target)} g` : 'g'}</span>
      </span>
      {target ? (
        <div className="bar" role="img" aria-label={`${Math.round((value / target) * 100)}% of target`}>
          <i style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

const snapOf = (r: Recipe) => {
  const m = perServing(r);
  return { name: r.name, g: m.g, kcal: m.kcal, p: m.p, c: m.c, f: m.f };
};

export function DayView({ date }: { date: string }) {
  const { data, setEntries, setTargets, toast } = useStore();
  const router = useRouter();
  const today = todayKey();
  const entries = data.days[date]?.entries ?? [];
  const prevEntries = data.days[addDays(date, -1)]?.entries ?? [];
  const t = dayTotals(data.days[date], data.recipes);
  const st = data.settings;
  const tgt = st.kcal;
  const scale = Math.max(tgt || 0, t.kcal, 1);
  const diff = tgt ? tgt - t.kcal : null;

  const [q, setQ] = useState('');
  const [quick, setQuick] = useState({ name: '', kcal: '', p: '', c: '', f: '' });

  const picks = useMemo(() => {
    const lu = lastUsed(data.days);
    const needle = q.trim().toLowerCase();
    return Object.values(data.recipes)
      .filter(r => !needle || r.name.toLowerCase().includes(needle))
      .sort((a, b) => (lu[b.id] || '').localeCompare(lu[a.id] || '') || a.name.localeCompare(b.name));
  }, [data.recipes, data.days, q]);

  const update = (next: DayEntry[]) => setEntries(date, next);
  const add = (r: Recipe) => {
    update([...entries, { id: uid('e'), recipeId: r.id, servings: 1, snap: snapOf(r) }]);
    toast(`Added ${r.name}`);
  };
  const setServings = (id: string, s: number) =>
    update(entries.map(e => (e.id === id ? { ...e, servings: s } : e)));
  const addQuick = () => {
    const snap = { name: quick.name.trim() || 'Quick add', kcal: num(quick.kcal) ?? 0, p: num(quick.p) ?? 0, c: num(quick.c) ?? 0, f: num(quick.f) ?? 0 };
    if (!snap.kcal && !snap.p && !snap.c && !snap.f) return toast('Enter at least one value to add.');
    update([...entries, { id: uid('e'), recipeId: null, servings: 1, snap }]);
    setQuick({ name: '', kcal: '', p: '', c: '', f: '' });
    toast(`Added ${snap.name}`);
  };
  const seg = (v: number, c: string) => <i style={{ width: `${(v / scale) * 100}%`, background: `var(${c})` }} />;
  const target = (k: keyof Settings, label: string, placeholder?: string) => (
    <label className="fld">
      {label}
      <NumberField value={st[k]} placeholder={placeholder} onCommit={v => setTargets({ [k]: v })} />
    </label>
  );

  return (
    <>
      <div className="daynav">
        <Link className="btn quiet icon" href={`/day?date=${addDays(date, -1)}`} aria-label="Previous day">‹</Link>
        <div className="date">
          <h2>{date === today ? 'Today' : fmtLong(date)}</h2>
          <input type="date" value={date} aria-label="Pick a date" onChange={e => e.target.value && router.push(`/day?date=${e.target.value}`)} />
        </div>
        {date !== today && <Link className="btn quiet" href="/day">Today</Link>}
        <Link className="btn quiet icon" href={`/day?date=${addDays(date, 1)}`} aria-label="Next day">›</Link>
      </div>

      <section className="hero" aria-label="Day totals">
        <div className="kcal">
          <span className="big">{r0(t.kcal)}</span>
          <span className="of">{tgt ? `of ${r0(tgt)} kcal` : 'kcal'}</span>
          {diff != null && <span className={`left ${diff < 0 ? 'over' : ''}`}>{diff >= 0 ? `${r0(diff)} left` : `${r0(-diff)} over`}</span>}
        </div>
        <div className="kbar" role="img" aria-label="Calories split by protein, carbs and fat">
          {seg(t.p * 4, '--p')}
          {seg(t.c * 4, '--c')}
          {seg(t.f * 9, '--f')}
          {tgt && t.kcal > tgt ? <span className="tgt" style={{ left: `${(tgt / scale) * 100}%` }} /> : null}
        </div>
        <div className="kbar-note">Bar shows where the calories come from: protein, carbs, fat.</div>
        <MacroRow label="Protein" color="--p" value={t.p} target={st.p} />
        <MacroRow label="Carbs" color="--c" value={t.c} target={st.c} />
        <MacroRow label="Fat" color="--f" value={t.f} target={st.f} />
        <details className="targets">
          <summary>Daily targets</summary>
          <div className="tgrid">
            {target('kcal', 'Calories')}
            {target('p', 'Protein (g)')}
            {target('c', 'Carbs (g)', 'None')}
            {target('f', 'Fat (g)', 'None')}
          </div>
        </details>
      </section>

      <h3>Eaten</h3>
      {entries.length ? (
        <ul className="entries">
          {entries.map(e => {
            const m = entryInfo(e, data.recipes);
            return (
              <li className="entry" key={e.id}>
                <span className="t">
                  {m.name}
                  {m.gone && <small className="muted"> (recipe deleted)</small>}
                </span>
                <span className="m">
                  {r0(m.kcal)} kcal, {r1(m.p)} g protein, {r1(m.c)} g carbs, {r1(m.f)} g fat
                  {!m.quick && m.g ? `, about ${r0(m.g)} g` : ''}
                </span>
                <span className="ctl">
                  {!m.quick && (
                    <>
                      <button className="btn quiet icon" aria-label="Fewer servings" onClick={() => setServings(e.id, Math.max(0.25, e.servings - 0.5))}>−</button>
                      <NumberField value={e.servings} aria-label="Servings" onCommit={v => (v && v > 0 ? setServings(e.id, v) : undefined)} />
                      <button className="btn quiet icon" aria-label="More servings" onClick={() => setServings(e.id, e.servings + 0.5)}>+</button>
                    </>
                  )}
                  <button className="btn quiet icon" aria-label={`Remove ${m.name}`} onClick={() => update(entries.filter(x => x.id !== e.id))}>×</button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">Nothing logged for this day yet. Pick a recipe below.</p>
      )}
      {!entries.length && prevEntries.length > 0 && (
        <button className="btn" onClick={() => { update(prevEntries.map(e => ({ ...e, id: uid('e') }))); toast('Copied the previous day'); }}>
          Copy the previous day&apos;s {prevEntries.length} item{prevEntries.length > 1 ? 's' : ''}
        </button>
      )}

      <div className="picker">
        <h3>Add food</h3>
        {Object.keys(data.recipes).length ? (
          <>
            <input className="txt" type="search" placeholder="Search your recipes" aria-label="Search recipes" value={q} onChange={e => setQ(e.target.value)} />
            <ul className="plist">
              {picks.length ? (
                picks.map(r => {
                  const m = perServing(r);
                  return (
                    <li key={r.id}>
                      <button onClick={() => add(r)}>
                        <span>{r.name}</span>
                        <span className="pm">{r0(m.kcal)} kcal, {r1(m.p)} g protein</span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="empty" style={{ padding: '12px 14px' }}>No recipe matches “{q}”.</li>
              )}
            </ul>
          </>
        ) : (
          <p className="muted">
            You have no recipes yet. <Link className="btn" href="/recipes/new">Create your first recipe</Link>
          </p>
        )}
        <details className="quick">
          <summary>Quick add without a recipe</summary>
          <div className="qgrid">
            <label className="fld qn">Name<input className="txt" placeholder="e.g. Lunch out" value={quick.name} onChange={e => setQuick({ ...quick, name: e.target.value })} /></label>
            {(['kcal', 'p', 'c', 'f'] as const).map(k => (
              <label className="fld" key={k}>
                {{ kcal: 'kcal', p: 'Protein', c: 'Carbs', f: 'Fat' }[k]}
                <input className="txt" inputMode="decimal" value={quick[k]} onChange={e => setQuick({ ...quick, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="actions"><button className="btn" onClick={addQuick}>Add to day</button></div>
        </details>
      </div>
    </>
  );
}
