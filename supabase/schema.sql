-- Draft schema for when the app moves to Supabase. Not used yet.
-- One row per entity, matching the Repository interface in src/lib/storage/repository.ts.
-- Row level security limits every table to the signed-in user's own rows.

create table settings (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  kcal numeric, p numeric, c numeric, f numeric
);

create table recipes (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  servings numeric not null default 1,
  ingredients jsonb not null default '[]',  -- [{name, grams, kcal, p, c, f}], macros per 100 g
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
alter table day_logs enable row level security;
alter table weights enable row level security;

create policy "own rows" on settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on recipes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on day_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on weights for all using (user_id = auth.uid()) with check (user_id = auth.uid());
