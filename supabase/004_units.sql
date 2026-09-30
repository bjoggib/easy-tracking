-- Run once in the SQL editor: remembers each user's choice of metric or US units.
alter table settings add column if not exists units text not null default 'metric' check (units in ('metric', 'us'));
