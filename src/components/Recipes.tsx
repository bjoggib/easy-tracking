'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { num, r0, r1, uid } from '@/lib/format';
import { knownIngredients, MACRO_KEYS, perServing, recipeTotals } from '@/lib/macros';
import type { Recipe } from '@/lib/types';

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
        <h2 style={{ margin: 0 }}>Recipes</h2>
        <Link className="btn primary" href="/recipes/new">New recipe</Link>
      </div>
      {hasAny ? (
        <>
          <input className="txt" type="search" style={{ marginTop: 16 }} placeholder="Search recipes" aria-label="Search recipes" value={q} onChange={e => setQ(e.target.value)} />
          <ul className="rlist">
            {list.length ? (
              list.map(r => {
                const m = perServing(r);
                return (
                  <li key={r.id}>
                    <Link href={`/recipes/${r.id}`}>
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
              <li className="empty">No recipe matches “{q}”.</li>
            )}
          </ul>
        </>
      ) : (
        <p className="empty">
          Save a recipe once with its ingredients, and it will be ready to add to any day. Values are entered per 100 g, the way they
          appear on food labels.
        </p>
      )}
    </>
  );
}

type IngDraft = { name: string; grams: string; kcal: string; p: string; c: string; f: string };
const blank = (): IngDraft => ({ name: '', grams: '', kcal: '', p: '', c: '', f: '' });
const str = (v: number | undefined) => (v == null ? '' : String(v));

export function RecipeEditor({ id }: { id?: string }) {
  const { data, saveRecipe, deleteRecipe, toast } = useStore();
  const router = useRouter();
  const existing = id ? data.recipes[id] : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [servings, setServings] = useState(str(existing?.servings ?? 1));
  const [ings, setIngs] = useState<IngDraft[]>(() =>
    existing?.ingredients.length
      ? existing.ingredients.map(i => ({ name: i.name, grams: str(i.grams), kcal: str(i.kcal), p: str(i.p), c: str(i.c), f: str(i.f) }))
      : [blank(), blank()],
  );
  const [confirmDel, setConfirmDel] = useState(false);
  const known = useMemo(() => knownIngredients(data.recipes), [data.recipes]);

  if (id && !existing) {
    return (
      <>
        <h2>Recipe not found</h2>
        <p className="muted">It may have been deleted. <Link href="/recipes">Back to all recipes</Link></p>
      </>
    );
  }

  const t = recipeTotals(ings);
  const s = num(servings) || 1;
  const setIng = (i: number, patch: Partial<IngDraft>) => setIngs(list => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  /** Fill macros from an ingredient used in another recipe, if this row has none yet. */
  const autofill = (i: number) => {
    const row = ings[i];
    const k = known[row.name.trim().toLowerCase()];
    if (!k || MACRO_KEYS.some(m => row[m] !== '')) return;
    setIng(i, { kcal: str(k.kcal), p: str(k.p), c: str(k.c), f: str(k.f), grams: row.grams || str(k.grams) });
  };

  const save = () => {
    const n = name.trim();
    if (!n) return toast('Give the recipe a name before saving.');
    const recipe: Recipe = {
      id: existing?.id ?? uid('r'),
      name: n,
      servings: Math.max(0.1, num(servings) || 1),
      ingredients: ings
        .filter(i => i.name.trim() || num(i.grams) != null)
        .map(i => ({ name: i.name.trim(), grams: num(i.grams) ?? 0, kcal: num(i.kcal) ?? 0, p: num(i.p) ?? 0, c: num(i.c) ?? 0, f: num(i.f) ?? 0 })),
      updatedAt: new Date().toISOString(),
    };
    saveRecipe(recipe);
    toast(`Saved ${n}`);
    router.push('/recipes');
  };

  const remove = () => {
    if (!existing) return;
    if (!confirmDel) return setConfirmDel(true);
    deleteRecipe(existing.id);
    toast(`Deleted ${existing.name}. Days that used it keep their numbers.`);
    router.push('/recipes');
  };

  const field = (i: number, k: Exclude<keyof IngDraft, 'name'>, label: string) => (
    <label>
      <span>{label}</span>
      <input className="txt" inputMode="decimal" value={ings[i][k]} onChange={e => setIng(i, { [k]: e.target.value })} />
    </label>
  );

  return (
    <>
      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn quiet" href="/recipes">‹ All recipes</Link>
      </div>
      <h2>{existing ? 'Edit recipe' : 'New recipe'}</h2>
      <div className="row" style={{ alignItems: 'end' }}>
        <label className="fld" style={{ flex: 3, minWidth: 200 }}>
          Name
          <input className="txt" value={name} placeholder="e.g. Lentil dal" autoFocus={!existing} onChange={e => setName(e.target.value)} />
        </label>
        <label className="fld" style={{ flex: 1, minWidth: 110 }}>
          Servings it makes
          <input className="txt" inputMode="decimal" value={servings} onChange={e => setServings(e.target.value)} />
        </label>
      </div>

      <h3>Ingredients</h3>
      <p className="hint">
        Grams is the amount in the whole recipe. Nutrition is per 100 g, as printed on the label. Ingredients you&apos;ve used before fill in
        automatically.
      </p>
      <datalist id="knownIng">
        {Object.values(known).map(i => <option key={i.name} value={i.name} />)}
      </datalist>
      {ings.map((row, i) => (
        <div className="ing" key={i}>
          <label className="iname">
            <span>Ingredient</span>
            <input className="txt" list="knownIng" placeholder="e.g. Oats" value={row.name} onChange={e => setIng(i, { name: e.target.value })} onBlur={() => autofill(i)} />
          </label>
          {field(i, 'grams', 'Grams')}
          {field(i, 'kcal', 'kcal/100g')}
          {field(i, 'p', 'Protein')}
          {field(i, 'c', 'Carbs')}
          {field(i, 'f', 'Fat')}
          <button className="btn quiet icon rm" aria-label="Remove ingredient" onClick={() => setIngs(list => (list.length > 1 ? list.filter((_, j) => j !== i) : [blank()]))}>×</button>
        </div>
      ))}
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => setIngs(list => [...list, blank()])}>Add ingredient</button>
      </div>

      <div className="totals">
        <table>
          <thead>
            <tr><th></th><th>Weight</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr>
          </thead>
          <tbody>
            <tr><td>Whole recipe</td><td>{r0(t.g)} g</td><td>{r0(t.kcal)}</td><td>{r1(t.p)} g</td><td>{r1(t.c)} g</td><td>{r1(t.f)} g</td></tr>
            <tr>
              <td className="hl">Per serving</td><td>{r0(t.g / s)} g</td><td className="hl">{r0(t.kcal / s)}</td>
              <td className="hl">{r1(t.p / s)} g</td><td>{r1(t.c / s)} g</td><td>{r1(t.f / s)} g</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={save}>Save recipe</button>
        <Link className="btn quiet" href="/recipes">Cancel</Link>
        <span className="spacer" />
        {existing && <button className="btn danger" onClick={remove}>{confirmDel ? 'Tap again to delete' : 'Delete recipe'}</button>}
      </div>
    </>
  );
}
