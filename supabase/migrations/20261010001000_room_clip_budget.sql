-- Trava de armazenamento: o plano gratuito do Supabase tem 1 GB para TODAS as salas. Com clips longos e em
-- 1080p (uns 25 MB cada), uma partida cheia poderia ocupar tudo. Cada sala fica limitada a 400 MB de clips.
-- Quando o limite é atingido, o app mantém o arquivo no computador do jogador e avisa.

create or replace function public.attach_clip(
  p_mark uuid,
  p_storage_path text,
  p_bytes int,
  p_duration_ms int,
  p_thumb_path text default null
) returns public.clips
language plpgsql security definer set search_path = public as $$
declare
  v_mark marks;
  v_room rooms;
  v_clip clips;
  v_base text;
  v_used bigint;
begin
  select * into v_mark from marks where id = p_mark;
  if not found or v_mark.user_id <> auth.uid() then raise exception 'mark_not_found'; end if;
  select * into v_room from rooms where id = v_mark.room_id;
  if v_room.clip_policy = 'off' then raise exception 'clips_disabled'; end if;

  v_base := format('%s/%s/%s', v_mark.room_id, v_mark.user_id, v_mark.id);
  if p_storage_path <> v_base || '.mp4'
     or (p_thumb_path is not null and p_thumb_path <> v_base || '.jpg') then
    raise exception 'invalid_path';
  end if;
  if p_bytes is null or p_bytes <= 0 or p_bytes > 52428800 then raise exception 'invalid_size'; end if;

  if not exists (select 1 from clips where mark_id = p_mark)
     and (select count(*) from clips
           where room_id = v_mark.room_id and user_id = auth.uid()) >= 10 then
    raise exception 'clip_limit';
  end if;

  select coalesce(sum(bytes), 0) into v_used from clips
   where room_id = v_mark.room_id and mark_id <> p_mark;
  if v_used + p_bytes > 419430400 then raise exception 'room_clip_budget'; end if;  -- 400 MB por sala

  insert into clips (mark_id, room_id, user_id, storage_path, bytes, duration_ms, thumb_path, expires_at)
  values (p_mark, v_mark.room_id, auth.uid(), p_storage_path, p_bytes, p_duration_ms, p_thumb_path,
          greatest(coalesce(v_room.ends_at, now()), now()) + interval '24 hours')
  on conflict (mark_id) do update set bytes = excluded.bytes
  returning * into v_clip;

  insert into events (room_id, user_id, type, payload)
  values (v_mark.room_id, auth.uid(), 'clip', jsonb_build_object('bytes', p_bytes));
  return v_clip;
end $$;
