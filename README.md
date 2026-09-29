# Easy Tracking

Meals built from foods (search Open Food Facts or enter your own, then type only the amount), macros incl. sugar, fibre and salt, daily and weekly intake tracking, and morning/evening weight with a rolling 7-day average.
Next.js (App Router) + TypeScript, no UI dependencies. Data is stored in `localStorage` or Supabase.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Structure

```
src/
  app/                  routes: /day, /week, /meals, /foods (+ /new, /[id]), /weight; api/off proxies Open Food Facts
  components/           DayView, WeekView, Recipes (meals), Foods, FoodPicker (search), WeightView, Header, AuthGate, NumberField
  lib/
    types.ts            data model
    macros.ts           all calculations (meal totals, per serving, per amount, day totals, weight averages)
    foods.ts, off.ts    food list helpers; Open Food Facts normalisation
    dates.ts, format.ts helpers
    store.tsx           React context: holds data, applies changes optimistically, persists via the repository
    storage/
      repository.ts     the interface every backend implements
      local.ts          localStorage implementation
      supabase.ts       Supabase implementation
      index.ts          picks the backend from NEXT_PUBLIC_STORAGE
supabase/schema.sql     tables + row level security
```

## Supabase

Set `NEXT_PUBLIC_STORAGE=supabase` plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`
(see `.env.example`), and run `supabase/schema.sql` once in the SQL editor.

- Sign-in is with Google or an emailed magic link (`src/components/AuthGate.tsx`). Google must be enabled under
  Authentication → Sign In / Providers, with the OAuth client's redirect URI set to `<SUPABASE_URL>/auth/v1/callback`. Add each deployed URL under
  Authentication → URL Configuration → Redirect URLs.
- `src/lib/storage/supabase.ts` implements `Repository`; row level security keeps each user to their own rows.
- On the first sign-in in a browser that has local data and an empty account, that data is copied up once.

## Notes on behaviour

- Foods hold values per 100 g (or ml). A meal copies them into its ingredients, so it stays correct if a food is deleted;
  editing a food updates the meals that use it. Picking an Open Food Facts result saves it to My foods.
- Amounts in a meal are for the whole meal.
- Editing a meal updates past days that use it. Deleting one leaves past days with the values captured when the entry was added.
- Week averages count only days with food logged.
- The 7-day weight average is the mean of daily averages over the last 7 calendar days, skipping days without readings.
