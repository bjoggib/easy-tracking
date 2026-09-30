-- Run once in the SQL editor: storage for food photos uploaded from the app.
-- Photos are public by URL (the path includes a random id), so they can be shown with a plain <img>.
-- Each user can only add, replace or delete files in the folder named after their own user id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-images', 'food-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "food images: read own" on storage.objects for select to authenticated
  using (bucket_id = 'food-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "food images: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'food-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "food images: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'food-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'food-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "food images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'food-images' and (storage.foldername(name))[1] = auth.uid()::text);
