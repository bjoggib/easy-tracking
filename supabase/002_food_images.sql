-- Run once in the SQL editor if you created the tables before food images were added.
alter table foods add column if not exists image text;
