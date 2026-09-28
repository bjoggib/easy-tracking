# Plate & Scale

Recipes with macros, daily and weekly intake tracking, and morning/evening weight with a rolling 7-day average.
Next.js (App Router) + TypeScript, no UI dependencies. Data is stored in `localStorage` for now.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Structure

```
src/
  app/                  routes: /day, /week, /recipes, /recipes/new, /recipes/[id], /weight
  components/           DayView, WeekView, Recipes (list + editor), WeightView (+ chart), Header, NumberField
  lib/
    types.ts            data model
    macros.ts           all calculations (recipe totals, per serving, day totals, weight averages)
    dates.ts, format.ts helpers
    store.tsx           React context: holds data, applies changes optimistically, persists via the repository
    storage/
      repository.ts     the interface every backend implements
      local.ts          localStorage implementation (current)
      index.ts          picks the backend from NEXT_PUBLIC_STORAGE
supabase/schema.sql     draft tables + row level security for the Supabase move
```

## Moving to Supabase

1. Create the tables from `supabase/schema.sql`.
2. `npm i @supabase/supabase-js` (and `@supabase/ssr` if you add server-side auth).
3. Add `src/lib/storage/supabase.ts` with a class implementing `Repository`. Each method is one upsert or delete
   on a single row, so it maps directly: `upsertRecipe` → `recipes.upsert`, `upsertDay` → `day_logs.upsert`, etc.
   `load()` selects all four tables and assembles an `AppData` object.
4. Return it from `createRepository()` when `NEXT_PUBLIC_STORAGE=supabase`, and add a sign-in page.
5. To bring existing browser data along, read the `plate-and-scale-v1` key from localStorage once and upsert it.

The UI does not need to change: it only talks to `useStore()`.

## Notes on behaviour

- Nutrition is entered per 100 g; grams are the amount in the whole recipe.
- Editing a recipe updates past days that use it. Deleting one leaves past days with the values captured when the entry was added.
- Week averages count only days with food logged.
- The 7-day weight average is the mean of daily averages over the last 7 calendar days, skipping days without readings.
