'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { num, r0, r1, uid } from '@/lib/format';
import { ensureFood, pickMacros, sameMacros } from '@/lib/foods';
import { forAmount, MACRO_KEYS, MACRO_LABELS, perServing, recipeTotals, scale, type MacroKey } from '@/lib/macros';
import type { Food, Ingredient, Macros, Recipe } from '@/lib/types';
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
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>My meals</h2>
        <span className="row">
          <Link className="btn quiet" href="/foods">My foods</Link>
          <Link className="btn primary" href="/meals/new">New meal</Link>
        </span>
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
                        {r.ingredients.length} ingredients, makes {r1(r.servings)} serving{r.servings === 1 ? '' : 's'}. Per serving: {r1(m.p)} g protein, {r1(m.c)} g carbs, {r1(m.f)} g fat
                      </span>
                      <span className="rk">{r0(m.kcal)}<small>kcal per serving</small></span>
                    </Link>
                  </li>
                );
              })
            ) : (
              <li className="empty">No meal matches “{q}”.</li>
            )}
          </ul>
        </>
      ) : (
        <p className="empty">
          Save a meal once with its ingredients, and it will be ready to add to any day. Search for each food and enter how much
          goes in; the nutrition fills in for you.
        </p>
      )}
    </>
  );
}

type IngDraft = { key: string; name: string; grams: string; foodId?: string; unit: 'g' | 'ml'; edit: boolean } & Record<MacroKey, string>;

const str = (v: number | undefined) => (v == null ? '' : String(v));
const noValues = () => Object.fromEntries(MACRO_KEYS.map(k => [k, ''])) as Record<MacroKey, string>;
const blank = (): IngDraft => ({ key: uid('i'), name: '', grams: '', unit: 'g', edit: false, ...noValues() });
const valuesOf = (m: Partial<Macros>) => Object.fromEntries(MACRO_KEYS.map(k => [k, str(m[k])])) as Record<MacroKey, string>;
const hasValues = (d: IngDraft) => MACRO_KEYS.some(k => d[k] !== '');
const macrosOf = (d: IngDraft): Macros => pickMacros(Object.fromEntries(MACRO_KEYS.map(k => [k, num(d[k]) ?? 0])));
const fromIngredient = (i: Ingredient): IngDraft => ({
  key: uid('i'), name: i.name, grams: str(i.grams), foodId: i.foodId, unit: i.unit ?? 'g', edit: false, ...valuesOf(i),
});

/** Units shown in the per-100 value fields. */
const UNIT: Record<MacroKey, string> = { kcal: 'kcal', p: 'g', c: 'g', f: 'g', sugar: 'g', fibre: 'g', salt: 'g' };

export function RecipeEditor({ id }: { id?: string }) {
  const { data, saveRecipe, deleteRecipe, saveFood, toast } = useStore();
  const router = useRouter();
  const existing = id ? data.recipes[id] : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [servings, setServings] = useState(str(existing?.servings ?? 1));
  const [ings, setIngs] = useState<IngDraft[]>(() =>
    existing?.ingredients.length ? existing.ingredients.map(fromIngredient) : [blank()],
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

  const t = recipeTotals(ings);
  const s = num(servings) || 1;
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
      // Keep the food list in step: corrected values update the food, new ones become foods.
      let food: Food | undefined = (i.foodId && data.foods[i.foodId]) || byName.get(label.toLowerCase());
      if (!food) {
        food = { id: uid('fd'), name: label, unit: i.unit, source: 'manual', updatedAt: now, ...m };
        saveFood(food);
        byName.set(label.toLowerCase(), food);
      } else if (!sameMacros(food, m)) {
        food = { ...food, ...m, updatedAt: now };
        saveFood(food);
      }
      return { name: label, grams: num(i.grams) ?? 0, foodId: food.id, unit: i.unit, ...m };
    });
    saveRecipe({
      id: existing?.id ?? uid('r'),
      name: n,
      servings: Math.max(0.1, num(servings) || 1),
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
      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn quiet" href="/meals">‹ All meals</Link>
      </div>
      <h2>{existing ? 'Edit meal' : 'New meal'}</h2>
      <div className="row" style={{ alignItems: 'end' }}>
        <label className="fld" style={{ flex: 3, minWidth: 200 }}>
          Name
          <input className="txt" value={name} placeholder="e.g. Overnight oats" autoFocus={!existing} onChange={e => setName(e.target.value)} />
        </label>
        <label className="fld" style={{ flex: 1, minWidth: 110 }}>
          Servings it makes
          <input className="txt" inputMode="decimal" value={servings} onChange={e => setServings(e.target.value)} />
        </label>
      </div>

      <h3>Ingredients</h3>
      <p className="hint">
        Search for each food and enter how much goes into the whole meal. Nutrition comes from your foods or Open Food Facts; you can
        type a barcode number too.
      </p>
      {ings.map(row => {
        const amount = forAmount(macrosOf(row), num(row.grams) ?? 0);
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
                <input id={`amt-${row.key}`} className="txt" inputMode="decimal" aria-label={`Amount of ${row.name || 'ingredient'} in ${row.unit}`} placeholder="0" value={row.grams} onChange={e => setIng(row.key, { grams: e.target.value })} />
                <span>{row.unit}</span>
              </label>
              <span className="ik">{hasValues(row) && num(row.grams) ? <>{r0(amount.kcal)}<small>kcal</small></> : null}</span>
              <button className="btn quiet icon" aria-label={`Remove ${row.name || 'ingredient'}`} onClick={() => setIngs(list => (list.length > 1 ? list.filter(x => x.key !== row.key) : [blank()]))}>×</button>
            </div>
            {hasValues(row) && !row.edit && (
              <div className="ing-sub">
                <span>
                  Per 100 {row.unit}: {r0(num(row.kcal))} kcal, {r1(num(row.p))} g protein, {r1(num(row.c))} g carbs, {r1(num(row.f))} g fat
                </span>
                <button type="button" className="linkish" onClick={() => setIng(row.key, { edit: true })}>Edit values</button>
              </div>
            )}
            {row.edit && (
              <div className="ing-vals">
                <p className="hint" style={{ gridColumn: '1/-1', margin: 0 }}>Per 100 {row.unit}, as printed on the label.</p>
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
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => setIngs(list => [...list, blank()])}>Add ingredient</button>
      </div>

      <MacroTable rows={[
        { label: 'Whole meal', m: t },
        { label: 'Per serving', m: scale(t, 1 / s), hl: true },
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

/** Totals table: weight, kcal, then every nutrient in grams. */
export function MacroTable({ rows }: { rows: { label: string; m: Macros & { g: number }; hl?: boolean }[] }) {
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
              <td>{r0(m.g)} g</td>
              <td className={hl ? 'hl' : undefined}>{r0(m.kcal)}</td>
              {cols.map(k => <td key={k} className={hl && k === 'p' ? 'hl' : undefined}>{k === 'salt' ? m[k].toFixed(2) : r1(m[k])} g</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
