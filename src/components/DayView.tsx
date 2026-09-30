'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { addDays, fmtLong, todayKey } from '@/lib/dates';
import { num, r0, r1, uid } from '@/lib/format';
import { ensureFood } from '@/lib/foods';
import { dayTotals, entryInfo, forAmount, lastUsed, perServing, zeroMacros } from '@/lib/macros';
import type { DayEntry, Food, Recipe } from '@/lib/types';
import { useUnits } from '@/lib/units';
import { FoodPicker, foodLabel } from './FoodPicker';
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

const snapOf = (r: Recipe) => ({ name: r.name, ...perServing(r) });

export function DayView({ date }: { date: string }) {
  const { data, setEntries, setTargets, saveFood, toast } = useStore();
  const u = useUnits();
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
  const [foodText, setFoodText] = useState('');
  const [food, setFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState('');

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
  const addFood = () => {
    const typed = num(amount);
    if (!food) return toast('Search for a food and pick it from the list.');
    if (!typed || typed <= 0) return toast(`Enter how many ${u.amountUnit(food.unit)} you had.`);
    const g = u.amountIn(typed, food.unit);
    update([...entries, { id: uid('e'), recipeId: null, servings: 1, snap: { name: foodLabel(food), ...forAmount(food, g) } }]);
    setFood(null);
    setFoodText('');
    setAmount('');
    toast(`Added ${u.fmtAmount(g, food.unit)} ${food.name}`);
  };
  const addQuick = () => {
    const snap = { ...zeroMacros(), name: quick.name.trim() || 'Quick add', kcal: num(quick.kcal) ?? 0, p: num(quick.p) ?? 0, c: num(quick.c) ?? 0, f: num(quick.f) ?? 0 };
    if (!snap.kcal && !snap.p && !snap.c && !snap.f) return toast('Enter at least one value to add.');
    update([...entries, { id: uid('e'), recipeId: null, servings: 1, snap }]);
    setQuick({ name: '', kcal: '', p: '', c: '', f: '' });
    toast(`Added ${snap.name}`);
  };
  const seg = (v: number, c: string) => <i style={{ width: `${(v / scale) * 100}%`, background: `var(${c})` }} />;
  const target = (k: 'kcal' | 'p' | 'c' | 'f', label: string, placeholder?: string) => (
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
        <p className="extra">
          Sugar <b>{r1(t.sugar)} g</b> · Fibre <b>{r1(t.fibre)} g</b> · Salt <b>{t.salt.toFixed(2)} g</b>
        </p>
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
                  {m.gone && <small className="muted"> (meal deleted)</small>}
                </span>
                <span className="m">
                  {r0(m.kcal)} kcal, {r1(m.p)} g protein, {r1(m.c)} g carbs, {r1(m.f)} g fat
                  {m.g ? `, ${m.quick ? '' : 'about '}${u.fmtAmount(m.g)}` : ''}
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
        <p className="empty">Nothing logged for this day yet. Add a food or a meal below.</p>
      )}
      {!entries.length && prevEntries.length > 0 && (
        <button className="btn" onClick={() => { update(prevEntries.map(e => ({ ...e, id: uid('e') }))); toast('Copied the previous day'); }}>
          Copy the previous day&apos;s {prevEntries.length} item{prevEntries.length > 1 ? 's' : ''}
        </button>
      )}

      <div className="picker">
        <h3>Add a food</h3>
        <div className="addfood">
          <FoodPicker
            value={foodText}
            onText={text => { setFoodText(text); setFood(null); }}
            onPick={p => {
              const f = ensureFood(p, data.foods, saveFood);
              setFood(f);
              setFoodText(foodLabel(f));
              document.getElementById('day-amount')?.focus();
            }}
          />
          <label className="amt">
            <input id="day-amount" className="txt" inputMode="decimal" placeholder="0" aria-label="Amount" value={amount}
              onChange={e => setAmount(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addFood(); }} />
            <span>{u.amountUnit(food?.unit)}</span>
          </label>
          <button className="btn primary" onClick={addFood}>Add</button>
        </div>
        {food && num(amount) ? (
          <p className="hint">
            {(() => { const m = forAmount(food, u.amountIn(num(amount)!, food.unit)); return `${r0(m.kcal)} kcal, ${r1(m.p)} g protein, ${r1(m.c)} g carbs, ${r1(m.f)} g fat`; })()}
          </p>
        ) : null}

        <h3>Add a meal</h3>
        {Object.keys(data.recipes).length ? (
          <>
            <input className="txt" type="search" placeholder="Search your meals" aria-label="Search meals" value={q} onChange={e => setQ(e.target.value)} />
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
                <li className="empty" style={{ padding: '12px 14px' }}>No meal matches “{q}”.</li>
              )}
            </ul>
          </>
        ) : (
          <p className="muted">
            You have no meals yet. <Link className="btn" href="/meals/new">Create your first meal</Link>
          </p>
        )}
        <details className="quick">
          <summary>Quick add without a meal</summary>
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
