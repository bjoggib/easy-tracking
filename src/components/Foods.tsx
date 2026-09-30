'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { num, r0, r1, uid } from '@/lib/format';
import { ensureFood, pickMacros } from '@/lib/foods';
import { MACRO_KEYS, MACRO_LABELS, type MacroKey } from '@/lib/macros';
import { resizeImage } from '@/lib/images';
import type { ScannedFood } from '@/lib/label';
import { supabase, usingSupabase } from '@/lib/supabase';
import type { Food } from '@/lib/types';
import { FoodPicker, foodLabel } from './FoodPicker';
import { unitsFor, useUnits } from '@/lib/units';
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

const blankDraft = (): Draft => ({
  name: '',
  brand: '',
  unit: 'g',
  ...(Object.fromEntries(MACRO_KEYS.map(k => [k, ''])) as Record<MacroKey, string>),
});

const fmt = (k: MacroKey, v: number) => (k === 'kcal' ? r0(v) : k === 'salt' ? v.toFixed(2) : r1(v));
const unitOf = (k: MacroKey) => (k === 'kcal' ? 'kcal' : 'g');

/**
 * Nutrition per 100 g next to the values for a chosen amount. Per-100 values are
 * text for a saved food, and inputs only while creating one (`onEdit`).
 */
function NutritionTable({ values, unit, onEdit }: { values: Record<MacroKey, number | string>; unit: 'g' | 'ml'; onEdit?: (k: MacroKey, v: string) => void }) {
  const u = useUnits();
  const [amount, setAmount] = useState(u.defaultAmount);
  const [prevSystem, setPrevSystem] = useState(u.system);
  if (prevSystem !== u.system) {
    // Units switched: show the same quantity in the new unit.
    setPrevSystem(u.system);
    const grams = num(amount) == null ? null : (u.system === 'us' ? unitsFor('metric') : unitsFor('us')).amountIn(num(amount)!, unit);
    setAmount(grams == null ? u.defaultAmount : u.amountField(grams, unit));
  }
  const factor = u.amountIn(num(amount) ?? 0, unit) / 100;
  return (
    <table className="ftable">
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col">Per 100 {unit}</th>
          <th scope="col">
            <label className="amt">
              <input className="txt" inputMode="decimal" aria-label={`Amount in ${u.amountUnit(unit)}`} value={amount} onChange={e => setAmount(e.target.value)} onFocus={e => e.target.select()} />
              <span>{u.amountUnit(unit)}</span>
            </label>
          </th>
        </tr>
      </thead>
      <tbody>
        {MACRO_KEYS.map(k => {
          const per100 = num(values[k]) ?? 0;
          return (
            <tr key={k}>
              <th scope="row">{MACRO_LABELS[k]}</th>
              <td>
                {onEdit ? (
                  <label className="amt">
                    <input className="txt" inputMode="decimal" aria-label={`${MACRO_LABELS[k]} per 100 ${unit}`} value={values[k]} onChange={e => onEdit(k, e.target.value)} />
                    <span>{unitOf(k)}</span>
                  </label>
                ) : (
                  <span className="per100">{fmt(k, per100)} <small>{unitOf(k)}</small></span>
                )}
              </td>
              <td className="calc">{fmt(k, per100 * factor)} <small>{unitOf(k)}</small></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function FoodEditor({ id }: { id?: string }) {
  return id ? <FoodView id={id} /> : <NewFood />;
}

/** A saved food: values are fixed; pick an amount to see what it adds up to. */
function FoodView({ id }: { id: string }) {
  const { data, deleteFood, toast } = useStore();
  const router = useRouter();
  const food = data.foods[id];
  const [confirmDel, setConfirmDel] = useState(false);
  const usedIn = useMemo(() => Object.values(data.recipes).filter(r => r.ingredients.some(i => i.foodId === id)), [data.recipes, id]);

  if (!food) {
    return (
      <>
        <h2>Food not found</h2>
        <p className="muted">It may have been deleted. <Link href="/foods">Back to my foods</Link></p>
      </>
    );
  }

  const remove = () => {
    if (!confirmDel) return setConfirmDel(true);
    deleteFood(food.id);
    toast(`Deleted ${food.name}. Meals that use it keep their values.`);
    router.push('/foods');
  };

  return (
    <>
      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn quiet" href="/foods">‹ My foods</Link>
      </div>
      <div className="fhero">
        <FoodThumb key={food.image} src={food.image} size={88} zoomable alt={foodLabel(food)} />
        <div>
          <h2>{food.name}</h2>
          <p className="muted">
            {food.brand ? `${food.brand} · ` : ''}
            {food.source === 'off' ? 'From Open Food Facts' : 'Entered by hand'}
          </p>
          <PhotoButton foodId={food.id} hasPhoto={!!food.image} />
        </div>
      </div>
      <h3>Nutrition</h3>
      <p className="hint">Change the amount at the top right to see the values for that much.</p>
      <NutritionTable values={food} unit={food.unit} />
      {usedIn.length > 0 && <p className="hint" style={{ marginTop: 16 }}>Used in {usedIn.map(r => r.name).join(', ')}.</p>}
      <div className="actions">
        <span className="spacer" />
        <button className="btn danger" onClick={remove}>{confirmDel ? 'Tap again to delete' : 'Delete food'}</button>
      </div>
    </>
  );
}

/** Picks a photo (camera or library on phones), then uploads it for the food. */
function PhotoButton({ foodId, hasPhoto }: { foodId: string; hasPhoto: boolean }) {
  const { setFoodImage, toast } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Pick an image file.');
    setBusy(true);
    try {
      await setFoodImage(foodId, file);
      toast('Photo saved');
    } catch (err) {
      console.error(err);
      toast('The photo could not be saved. Try again, or try a different photo.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <input ref={input} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0])} />
      <button type="button" className="btn quiet photo-btn" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Uploading…' : hasPhoto ? 'Change photo' : 'Add photo'}
      </button>
    </>
  );
}

/** Photo of a nutrition label → values via /api/label. Fills the form; the user reviews and saves. */
function ScanLabel({ onResult }: { onResult: (r: ScannedFood) => void }) {
  const { toast } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      // Large enough for small print, small enough for a quick upload.
      const jpeg = await resizeImage(file, 1600, 0.9);
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(jpeg);
      });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (usingSupabase) {
        const { data } = await supabase().auth.getSession();
        if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const res = await fetch('/api/label', { method: 'POST', headers, body: JSON.stringify({ image }) });
      const body = await res.json().catch(() => ({ error: 'Label scanning failed. Try again.' }));
      if (!res.ok) return toast(body.error ?? 'Label scanning failed. Try again.');
      onResult(body as ScannedFood);
    } catch (err) {
      console.error(err);
      toast('Label scanning failed. Try again.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="scan">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={e => onFile(e.target.files?.[0])} />
      <button type="button" className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Reading the label…' : 'Scan nutrition label'}
      </button>
      <span className="hint">Take a photo of the nutrition table; the values fill in below.</span>
    </div>
  );
}

/** Add a food: from Open Food Facts, or by entering the label's values once. */
function NewFood() {
  const { data, saveFood, toast } = useStore();
  const router = useRouter();
  const [d, setD] = useState<Draft>(blankDraft);
  const [search, setSearch] = useState('');
  const [scanNote, setScanNote] = useState<string | null>(null);

  const save = () => {
    const name = d.name.trim();
    if (!name) return toast('Give the food a name before saving.');
    if (MACRO_KEYS.every(k => d[k].trim() === '')) return toast('Enter the values from the label before saving.');
    const brand = d.brand.trim();
    const food: Food = {
      id: uid('fd'),
      source: 'manual',
      name,
      ...(brand ? { brand } : {}),
      unit: d.unit,
      ...pickMacros(Object.fromEntries(MACRO_KEYS.map(k => [k, num(d[k]) ?? 0]))),
      updatedAt: new Date().toISOString(),
    };
    saveFood(food);
    toast(`Saved ${name}`);
    router.push(`/foods/${food.id}`);
  };

  return (
    <>
      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn quiet" href="/foods">‹ My foods</Link>
      </div>
      <h2>New food</h2>
      <ScanLabel
        onResult={r => {
          setD(cur => ({
            ...cur,
            name: r.name || cur.name,
            brand: r.brand || cur.brand,
            unit: r.unit,
            ...(Object.fromEntries(MACRO_KEYS.map(k => [k, String(r.values[k])])) as Record<MacroKey, string>),
          }));
          setScanNote(r.notes);
        }}
      />
      {scanNote != null && (
        <p className="scan-note" role="status">
          Filled in from the label. Check the values below before saving{scanNote ? `. Note: ${scanNote}` : '.'}
        </p>
      )}
      <p className="hint">Or search Open Food Facts, type a barcode number, or enter the values from the label below.</p>
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
      <p className="hint">Enter the values per 100 {d.unit} from the label. They can&apos;t be changed after saving.</p>
      <NutritionTable values={d} unit={d.unit} onEdit={(k, v) => setD(cur => ({ ...cur, [k]: v }))} />
      <div className="actions">
        <button className="btn primary" onClick={save}>Save food</button>
        <Link className="btn quiet" href="/foods">Cancel</Link>
      </div>
    </>
  );
}
