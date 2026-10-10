-- Bucket privado de clips. Nome do objeto: {room_id}/{user_id}/{mark_id}.mp4 (e .jpg para a miniatura).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clips', 'clips', false, 52428800, array['video/mp4', 'image/jpeg'])
on conflict (id) do nothing;

create policy members_read_clips on storage.objects for select to authenticated
  using (bucket_id = 'clips'
         and public.is_member((storage.foldername(name))[1]::uuid));

create policy members_upload_own_clips on storage.objects for insert to authenticated
  with check (bucket_id = 'clips'
              and public.is_member((storage.foldername(name))[1]::uuid)
              and (storage.foldername(name))[2] = auth.uid()::text);

create policy members_delete_own_clips on storage.objects for delete to authenticated
  using (bucket_id = 'clips'
         and (storage.foldername(name))[2] = auth.uid()::text);

-- Realtime por Postgres Changes (ADR-09). Respeita RLS: cada cliente só recebe suas salas.
alter publication supabase_realtime add table
  public.rooms, public.room_members, public.marks, public.clips;
