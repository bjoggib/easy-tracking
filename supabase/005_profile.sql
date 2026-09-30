-- Run once in the SQL editor: which nutrients each user shows on the day page (besides calories).
alter table settings add column if not exists show jsonb not null default '["p", "c", "f"]'::jsonb;
