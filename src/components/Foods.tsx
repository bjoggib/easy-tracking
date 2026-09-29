'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { num, r0, r1, uid } from '@/lib/format';
import { ensureFood, pickMacros, sameMacros } from '@/lib/foods';
import { MACRO_KEYS, MACRO_LABELS, type MacroKey } from '@/lib/macros';
import type { Food } from '@/lib/types';
import { FoodPicker, foodLabel } from './FoodPicker';
import { FoodThumb } from './FoodThumb';

export function FoodList() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return Object.values(data.foods)
      .filter(f => words.every(w => foodLabel(f).toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.foods, q]);
  const hasAny = Object.keys(data.foods).length > 0;

  return (
    <>
      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn quiet" href="/meals">‹ My meals</Link>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>My foods</h2>
        <Link className="btn primary" href="/foods/new">New food</Link>
      </div>
      {hasAny ? (
        <>
          <input className="txt" type="search" style={{ marginTop: 16 }} placeholder="Search my foods" aria-label="Search my foods" value={q} onChange={e => setQ(e.target.value)} />
          <ul className="rlist foods">
            {list.length ? (
              list.map(f => (
                <li key={f.id}>
                  <Link href={`/foods/${f.id}`}>
                    <FoodThumb src={f.image} size={48} />
                    <span className="rn">{f.name}</span>
                    <span className="rs">
                      {f.brand ? `${f.brand}. ` : ''}Per 100 {f.unit}: {r1(f.p)} g protein, {r1(f.c)} g carbs, {r1(f.f)} g fat
                      {f.source === 'off' ? '. From Open Food Facts' : ''}
                    </span>
                    <span className="rk">{r0(f.kcal)}<small>kcal /100 {f.unit}</small></span>
                  </Link>
                </li>
              ))
            ) : (
              <li className="empty">No food matches “{q}”.</li>
            )}
          </ul>
        </>
      ) : (
        <p className="empty">
          Foods you pick or enter while building a meal are saved here, so next time you only type the amount.
        </p>
      )}
    </>
  );
}

type Draft = { name: string; brand: string; unit: 'g' | 'ml' } & Record<MacroKey, string>;

const str = (v: number | undefined) => (v == null ? '' : String(v));
const draftOf = (f?: Partial<Food>): Draft => ({
  name: f?.name ?? '',
  brand: f?.brand ?? '',
  unit: f?.unit ?? 'g',
  ...(Object.fromEntries(MACRO_KEYS.map(k => [k, str(f?.[k])])) as Record<MacroKey, string>),
});

export function FoodEditor({ id }: { id?: string }) {
  const { data, saveFood, deleteFood, saveRecipe, toast } = useStore();
  const router = useRouter();
  const existing = id ? data.foods[id] : undefined;
  const [d, setD] = useState<Draft>(() => draftOf(existing));
  const [amount, setAmount] = useState('100');
  const [search, setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const usedIn = useMemo(
    () => (existing ? Object.values(data.recipes).filter(r => r.ingredients.some(i => i.foodId === existing.id)) : []),
    [data.recipes, existing],
  );

  if (id && !existing) {
    return (
      <>
        <h2>Food not found</h2>
        <p className="muted">It may have been deleted. <Link href="/foods">Back to my foods</Link></p>
      </>
    );
  }

  const save = () => {
    const name = d.name.trim();
    if (!name) return toast('Give the food a name before saving.');
    const m = pickMacros(Object.fromEntries(MACRO_KEYS.map(k => [k, num(d[k]) ?? 0])));
    const brand = d.brand.trim();
    const food: Food = {
      ...(existing ?? { id: uid('fd'), source: 'manual' as const }),
      name,
      unit: d.unit,
      ...m,
      updatedAt: new Date().toISOString(),
    };
    if (brand) food.brand = brand;
    else delete food.brand;
    saveFood(food);
    // Meals copy a food's values; bring the ones using this food up to date.
    for (const r of usedIn) {
      if (r.ingredients.every(i => i.foodId !== food.id || (sameMacros(i, m) && i.name === foodLabel(food) && i.unit === food.unit))) continue;
      saveRecipe({
        ...r,
        ingredients: r.ingredients.map(i => (i.foodId === food.id ? { ...i, ...m, name: foodLabel(food), unit: food.unit } : i)),
        updatedAt: food.updatedAt,
      });
    }
    toast(usedIn.length ? `Saved ${name} and updated ${usedIn.length} meal${usedIn.length > 1 ? 's' : ''}` : `Saved ${name}`);
    router.push('/foods');
  };

  const remove = () => {
    if (!existing) return;
    if (!confirmDel) return setConfirmDel(true);
    deleteFood(existing.id);
    toast(`Deleted ${existing.name}. Meals that use it keep their values.`);
    router.push('/foods');
  };

  return (
    <>
      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn quiet" href="/foods">‹ My foods</Link>
      </div>
      <div className="row">
        {existing?.image && <FoodThumb src={existing.image} size={72} />}
        <h2>{existing ? 'Edit food' : 'New food'}</h2>
      </div>
      {!existing && (
        <>
          <p className="hint">Search Open Food Facts or type a barcode number to fill this in, or enter the values from the label.</p>
          <FoodPicker
            label="Search Open Food Facts"
            value={search}
            onText={setSearch}
            onPick={p => {
              if ('id' in p) return router.push(`/foods/${p.id}`);
              const f = ensureFood(p, data.foods, saveFood);
              toast(`Added ${f.name}`);
              router.push(`/foods/${f.id}`);
            }}
            autoFocus
          />
        </>
      )}
      <div className="fgrid">
        <label className="fld wide">
          Name
          <input className="txt" value={d.name} placeholder="e.g. Blueberries" onChange={e => setD({ ...d, name: e.target.value })} />
        </label>
        <label className="fld wide">
          Brand <small>(optional)</small>
          <input className="txt" value={d.brand} onChange={e => setD({ ...d, brand: e.target.value })} />
        </label>
        <label className="fld">
          Measured in
          <select className="txt" value={d.unit} onChange={e => setD({ ...d, unit: e.target.value as 'g' | 'ml' })}>
            <option value="g">grams</option>
            <option value="ml">millilitres</option>
          </select>
        </label>
      </div>
      <h3>Nutrition</h3>
      <p className="hint">Enter values per 100 {d.unit} from the label. Change the amount on the right to see the values for that much.</p>
      <table className="ftable">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Per 100 {d.unit}</th>
            <th scope="col">
              <label className="amt">
                <input className="txt" inputMode="decimal" aria-label={`Amount in ${d.unit}`} value={amount} onChange={e => setAmount(e.target.value)} />
                <span>{d.unit}</span>
              </label>
            </th>
          </tr>
        </thead>
        <tbody>
          {MACRO_KEYS.map(k => {
            const unit = k === 'kcal' ? 'kcal' : 'g';
            const v = ((num(d[k]) ?? 0) * (num(amount) ?? 0)) / 100;
            return (
              <tr key={k}>
                <th scope="row">{MACRO_LABELS[k]}</th>
                <td>
                  <label className="amt">
                    <input className="txt" inputMode="decimal" aria-label={`${MACRO_LABELS[k]} per 100 ${d.unit}`} value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })} />
                    <span>{unit}</span>
                  </label>
                </td>
                <td className="calc">
                  {k === 'kcal' ? r0(v) : k === 'salt' ? v.toFixed(2) : r1(v)} <small>{unit}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {usedIn.length > 0 && (
        <p className="hint">Used in {usedIn.map(r => r.name).join(', ')}. Saving updates those meals too.</p>
      )}
      <div className="actions">
        <button className="btn primary" onClick={save}>Save food</button>
        <Link className="btn quiet" href="/foods">Cancel</Link>
        <span className="spacer" />
        {existing && <button className="btn danger" onClick={remove}>{confirmDel ? 'Tap again to delete' : 'Delete food'}</button>}
      </div>
    </>
  );
}
