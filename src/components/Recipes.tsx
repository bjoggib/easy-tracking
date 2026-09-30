'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { num, r0, r1, uid } from '@/lib/format';
import { ensureFood, pickMacros } from '@/lib/foods';
import { forAmount, MACRO_KEYS, MACRO_LABELS, perServing, recipeTotals, type MacroKey } from '@/lib/macros';
import type { Food, Ingredient, Macros, Recipe } from '@/lib/types';
import { useUnits, type Units } from '@/lib/units';
import { FoodPicker, foodLabel, type Picked } from './FoodPicker';

export function RecipeList() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.values(data.recipes)
      .filter(r => !needle || r.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.recipes, q]);
  const hasAny = Object.keys(data.recipes).length > 0;

  return (
    <>
      <div className="listhead">
        <LibraryTabs current="meals" />
        <Link className="btn primary" href="/meals/new">New meal</Link>
      </div>
      {hasAny ? (
        <>
          <input className="txt" type="search" style={{ marginTop: 16 }} placeholder="Search meals" aria-label="Search meals" value={q} onChange={e => setQ(e.target.value)} />
          <ul className="rlist">
            {list.length ? (
              list.map(r => {
                const m = perServing(r);
                return (
                  <li key={r.id}>
                    <Link href={`/meals/${r.id}`}>
                      <span className="rn">{r.name}</span>
                      <span className="rs">
                        {r0(m.p)} g protein
                      </span>
                      <span className="rk">{r0(m.kcal)}<small>kcal</small></span>
                    </Link>
                  </li>
                );
              })
            ) : (
              <li className="empty">No match.</li>
            )}
          </ul>
        </>
      ) : (
        <p className="empty">No meals yet.</p>
      )}
    </>
  );
}

/**
 * `grams` holds the amount as typed, in the user's units. `orig*` remember a saved amount so an
 * untouched field keeps its exact grams instead of round-tripping through ounces.
 */
type IngDraft = {
  key: string;
  name: string;
  grams: string;
  origGrams?: number;
  origText?: string;
  foodId?: string;
  unit: 'g' | 'ml';
  edit: boolean;
} & Record<MacroKey, string>;

const str = (v: number | undefined) => (v == null ? '' : String(v));
const noValues = () => Object.fromEntries(MACRO_KEYS.map(k => [k, ''])) as Record<MacroKey, string>;
const blank = (): IngDraft => ({ key: uid('i'), name: '', grams: '', unit: 'g', edit: false, ...noValues() });
const valuesOf = (m: Partial<Macros>) => Object.fromEntries(MACRO_KEYS.map(k => [k, str(m[k])])) as Record<MacroKey, string>;
const hasValues = (d: IngDraft) => MACRO_KEYS.some(k => d[k] !== '');
const macrosOf = (d: IngDraft): Macros => pickMacros(Object.fromEntries(MACRO_KEYS.map(k => [k, num(d[k]) ?? 0])));
const fromIngredient = (i: Ingredient, u: Units): IngDraft => {
  const text = u.amountField(i.grams, i.unit ?? 'g');
  return { key: uid('i'), name: i.name, grams: text, origGrams: i.grams, origText: text, foodId: i.foodId, unit: i.unit ?? 'g', edit: false, ...valuesOf(i) };
};
const gramsOf = (d: IngDraft, u: Units) =>
  d.origText != null && d.grams === d.origText ? d.origGrams! : u.amountIn(num(d.grams) ?? 0, d.unit);

/** Units shown in the per-100 value fields. */
const UNIT: Record<MacroKey, string> = { kcal: 'kcal', p: 'g', c: 'g', f: 'g', sugar: 'g', fibre: 'g', salt: 'g' };

export function RecipeEditor({ id }: { id?: string }) {
  // Drafts hold amounts in the chosen units, so start fresh if the units change.
  const u = useUnits();
  return <MealEditor key={u.system} id={id} u={u} />;
}

function MealEditor({ id, u }: { id?: string; u: Units }) {
  const { data, saveRecipe, deleteRecipe, saveFood, toast } = useStore();
  const router = useRouter();
  const existing = id ? data.recipes[id] : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [ings, setIngs] = useState<IngDraft[]>(() =>
    existing?.ingredients.length ? existing.ingredients.map(i => fromIngredient(i, u)) : [blank()],
  );
  const [confirmDel, setConfirmDel] = useState(false);

  if (id && !existing) {
    return (
      <>
        <h2>Meal not found</h2>
        <p className="muted">It may have been deleted. <Link href="/meals">Back to all meals</Link></p>
      </>
    );
  }

  const t = recipeTotals(ings.map(i => ({ ...i, grams: gramsOf(i, u) })));
  const setIng = (key: string, patch: Partial<IngDraft>) => setIngs(list => list.map(x => (x.key === key ? { ...x, ...patch } : x)));

  const pick = (key: string, picked: Picked) => {
    const food = ensureFood(picked, data.foods, saveFood);
    setIng(key, { name: foodLabel(food), foodId: food.id, unit: food.unit, edit: false, ...valuesOf(food) });
    // Move focus to the amount, which is all that's left to enter.
    document.getElementById(`amt-${key}`)?.focus();
  };

  const onText = (row: IngDraft, text: string) =>
    // Typing a different name after picking a food detaches it, so stale values don't linger.
    setIng(row.key, row.foodId ? { name: text, foodId: undefined, edit: false, ...noValues() } : { name: text });

  const save = () => {
    const n = name.trim();
    if (!n) return toast('Give the meal a name before saving.');
    const rows = ings.filter(i => i.name.trim() || num(i.grams) != null);
    const missing = rows.find(i => !hasValues(i));
    if (missing) {
      setIng(missing.key, { edit: true });
      return toast(`Pick “${missing.name || 'the ingredient'}” from the list, or enter its values.`);
    }
    const byName = new Map(Object.values(data.foods).map(f => [foodLabel(f).toLowerCase(), f]));
    const now = new Date().toISOString();
    const ingredients = rows.map((i): Ingredient => {
      const m = macrosOf(i);
      const label = i.name.trim();
      // Values entered by hand become a new food, so next time only the amount is needed.
      let food: Food | undefined = (i.foodId && data.foods[i.foodId]) || byName.get(label.toLowerCase());
      if (!food) {
        food = { id: uid('fd'), name: label, unit: i.unit, source: 'manual', updatedAt: now, ...m };
        saveFood(food);
        byName.set(label.toLowerCase(), food);
      }
      return { name: label, grams: gramsOf(i, u), foodId: food.id, unit: i.unit, ...m };
    });
    saveRecipe({
      id: existing?.id ?? uid('r'),
      name: n,
      // A meal is always one serving; older meals saved with more servings keep theirs until edited.
      servings: 1,
      ingredients,
      updatedAt: now,
    });
    toast(`Saved ${n}`);
    router.push('/meals');
  };

  const remove = () => {
    if (!existing) return;
    if (!confirmDel) return setConfirmDel(true);
    deleteRecipe(existing.id);
    toast(`Deleted ${existing.name}. Days that used it keep their numbers.`);
    router.push('/meals');
  };

  return (
    <>
      <Link className="back" href="/meals">← Meals</Link>
      <h2>{existing ? 'Edit meal' : 'New meal'}</h2>
      <label className="fld">
        Name
        <input className="txt" value={name} placeholder="e.g. Overnight oats" autoFocus={!existing} onChange={e => setName(e.target.value)} />
      </label>

      <h3>Ingredients</h3>
      {ings.map(row => {
        const amount = forAmount(macrosOf(row), gramsOf(row, u));
        return (
          <div className="ing" key={row.key}>
            <div className="ing-top">
              <FoodPicker
                label="Ingredient"
                value={row.name}
                onText={text => onText(row, text)}
                onPick={f => pick(row.key, f)}
                onManual={text => setIng(row.key, { name: text, edit: true })}
              />
              <label className="amt">
                <input id={`amt-${row.key}`} className="txt" inputMode="decimal" aria-label={`Amount of ${row.name || 'ingredient'} in ${u.amountUnit(row.unit)}`} placeholder="0" value={row.grams} onChange={e => setIng(row.key, { grams: e.target.value })} />
                <span>{u.amountUnit(row.unit)}</span>
              </label>
              <span className="ik">{hasValues(row) && num(row.grams) ? <>{r0(amount.kcal)} <small>kcal</small><span className="ip">{r1(amount.p)} g protein</span></> : null}</span>
              <button className="btn quiet icon" aria-label={`Remove ${row.name || 'ingredient'}`} onClick={() => setIngs(list => (list.length > 1 ? list.filter(x => x.key !== row.key) : [blank()]))}>×</button>
            </div>
            {hasValues(row) && !row.edit && (
              <div className="ing-sub">
                <span>
                  {r0(num(row.kcal))} kcal · {r1(num(row.p))} g protein per 100 {row.unit}
                </span>
                {!row.foodId && <button type="button" className="linkish" onClick={() => setIng(row.key, { edit: true })}>Edit values</button>}
              </div>
            )}
            {row.edit && (
              <div className="ing-vals">
                <p className="hint" style={{ gridColumn: '1/-1', margin: 0 }}>Per 100 {row.unit}</p>
                {MACRO_KEYS.map(k => (
                  <label className="fld" key={k}>
                    {MACRO_LABELS[k]} <small>({UNIT[k]})</small>
                    <input className="txt" inputMode="decimal" value={row[k]} onChange={e => setIng(row.key, { [k]: e.target.value })} />
                  </label>
                ))}
                <label className="fld">
                  Unit
                  <select className="txt" value={row.unit} onChange={e => setIng(row.key, { unit: e.target.value as 'g' | 'ml' })}>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                  </select>
                </label>
                <div style={{ alignSelf: 'end' }}>
                  <button type="button" className="btn" onClick={() => setIng(row.key, { edit: false })} disabled={!hasValues(row)}>Done</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {t.kcal > 0 && (
        <div className="ing-top ing-total">
          <span>Total</span>
          <span className="ik">
            {r0(t.kcal)} <small>kcal</small>
            <span className="ip">{r1(t.p)} g protein</span>
          </span>
        </div>
      )}
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => setIngs(list => [...list, blank()])}>Add ingredient</button>
      </div>

      <MacroTable rows={[
        { label: 'Total', m: t },
      ]} />

      <div className="actions">
        <button className="btn primary" onClick={save}>Save meal</button>
        <Link className="btn quiet" href="/meals">Cancel</Link>
        <span className="spacer" />
        {existing && <button className="btn danger" onClick={remove}>{confirmDel ? 'Tap again to delete' : 'Delete meal'}</button>}
      </div>
    </>
  );
}

/** Meals | Foods switch at the top of both lists. */
export function LibraryTabs({ current }: { current: 'meals' | 'foods' }) {
  return (
    <nav className="seg" aria-label="Library">
      <Link href="/meals" aria-current={current === 'meals' ? 'page' : undefined}>Meals</Link>
      <Link href="/foods" aria-current={current === 'foods' ? 'page' : undefined}>Foods</Link>
    </nav>
  );
}

/** Totals table: weight, kcal, then every nutrient in grams. */
export function MacroTable({ rows }: { rows: { label: string; m: Macros & { g: number }; hl?: boolean }[] }) {
  const u = useUnits();
  const cols = MACRO_KEYS.filter(k => k !== 'kcal');
  return (
    <div className="totals">
      <table>
        <thead>
          <tr><th></th><th>Weight</th><th>kcal</th>{cols.map(k => <th key={k}>{MACRO_LABELS[k]}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(({ label, m, hl }) => (
            <tr key={label}>
              <td className={hl ? 'hl' : undefined}>{label}</td>
              <td>{u.fmtAmount(m.g)}</td>
              <td className={hl ? 'hl' : undefined}>{r0(m.kcal)}</td>
              {cols.map(k => <td key={k} className={hl && k === 'p' ? 'hl' : undefined}>{k === 'salt' ? m[k].toFixed(2) : r1(m[k])} g</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
