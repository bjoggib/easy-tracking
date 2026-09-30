-- Run once in the Supabase SQL editor (Database → SQL editor) to create the tables.
-- Row level security limits every table to the signed-in user's own rows.

create table settings (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  kcal numeric, p numeric, c numeric, f numeric,
  units text not null default 'metric' check (units in ('metric', 'us')),
  show jsonb not null default '["p", "c", "f"]'::jsonb  -- nutrients shown on the day page besides calories
);

create table recipes (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  servings numeric not null default 1,
  ingredients jsonb not null default '[]',  -- [{name, grams, foodId, unit, kcal, p, c, f, sugar, fibre, salt}], per 100 g
  updated_at timestamptz not null default now()
);

-- The user's own food list; values per 100 g (or 100 ml). Meals copy these values into their ingredients.
create table foods (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  brand text,
  unit text not null default 'g' check (unit in ('g', 'ml')),
  code text,                                -- barcode, when imported from Open Food Facts
  image text,                               -- product photo URL from Open Food Facts
  source text not null default 'manual' check (source in ('off', 'manual')),
  kcal numeric not null default 0,
  p numeric not null default 0,
  c numeric not null default 0,
  f numeric not null default 0,
  sugar numeric not null default 0,
  fibre numeric not null default 0,
  salt numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table day_logs (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  date date not null,
  entries jsonb not null default '[]',      -- [{id, recipeId, servings, snap}]
  primary key (user_id, date)
);

create table weights (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  date date not null,
  am numeric,
  pm numeric,
  primary key (user_id, date)
);

alter table settings enable row level security;
alter table recipes enable row level security;
alter table foods enable row level security;
alter table day_logs enable row level security;
alter table weights enable row level security;

create policy "own rows" on settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on recipes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on foods for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on day_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on weights for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Newer Supabase projects no longer expose new public tables to the Data API automatically.
grant select, insert, update, delete on settings, recipes, foods, day_logs, weights to authenticated;

-- Food photo storage: also run supabase/003_food_photos.sql.
