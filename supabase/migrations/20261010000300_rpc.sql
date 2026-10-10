-- Regras do jogo. O banco é a fonte da verdade; o cliente nunca é confiável.
-- Convenção de erro: raise exception '<codigo>' (ver RPC_ERRORS em packages/shared/src/types.ts).

-- ---------------------------------------------------------------- utilitários

create function public.server_time() returns timestamptz
language sql stable as $$ select now(); $$;

create function public.generate_room_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 símbolos, sem 0/O/1/I
  v_code text;
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where rooms.code = v_code);
  end loop;
  return v_code;
end $$;

-- Fecha por tempo as salas vencidas e marca como expiradas as antigas. Idempotente.
create function public.sweep_rooms() returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set status = 'finished', result = 'timeout', finished_at = now()
   where status = 'running' and ends_at < now();
  update rooms set status = 'expired'
   where status <> 'expired' and expires_at < now();
end $$;

-- Chamada pelo keepalive (anon) a cada 12 h: mantém o projeto gratuito ativo.
create function public.ping() returns timestamptz
language plpgsql security definer set search_path = public as $$
begin
  perform public.sweep_rooms();
  return now();
end $$;

-- ---------------------------------------------------------------- perfil e salas

create function public.upsert_profile(p_nickname text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare v_profile profiles;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into profiles (id, nickname) values (auth.uid(), trim(p_nickname))
  on conflict (id) do update set nickname = excluded.nickname
  returning * into v_profile;
  return v_profile;
end $$;

create function public.create_room(
  p_size int default 4,
  p_duration_s int default 3600,
  p_target_lines int default 2,
  p_clip_policy text default 'optional'
) returns public.rooms
language plpgsql security definer set search_path = public as $$
declare v_room rooms;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'profile_required';
  end if;
  if p_size not in (3, 4, 5) then raise exception 'invalid_size'; end if;
  if p_duration_s not between 300 and 14400 then raise exception 'invalid_duration'; end if;
  if p_target_lines < 1 or p_target_lines > 2 * p_size + 2 then
    raise exception 'invalid_target_lines';
  end if;
  if p_clip_policy not in ('off', 'optional', 'required') then
    raise exception 'invalid_clip_policy';
  end if;
  if (select count(*) from rooms
       where host_id = auth.uid() and status in ('lobby', 'running')) >= 3 then
    raise exception 'too_many_rooms';
  end if;

  insert into rooms (code, host_id, size, seed, duration_s, target_lines, clip_policy)
  values (generate_room_code(), auth.uid(), p_size, (random() * 9e15)::bigint,
          p_duration_s, p_target_lines, p_clip_policy)
  returning * into v_room;

  insert into room_members (room_id, user_id) values (v_room.id, auth.uid());
  insert into events (room_id, user_id, type, payload)
  values (v_room.id, auth.uid(), 'room_created',
          jsonb_build_object('size', p_size, 'target_lines', p_target_lines));
  return v_room;
end $$;

-- Necessária porque quem ainda não é membro não consegue ler a sala (RLS).
create function public.join_room(p_code text) returns public.rooms
language plpgsql security definer set search_path = public as $$
declare v_room rooms;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'profile_required';
  end if;

  -- limite de tentativas por usuário: segura quem tenta adivinhar códigos
  if (select count(*) from events
       where user_id = auth.uid() and type = 'join_attempt'
         and at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited';
  end if;
  insert into events (user_id, type) values (auth.uid(), 'join_attempt');

  select * into v_room from rooms where code = upper(trim(p_code));
  if not found then raise exception 'room_not_found'; end if;
  if v_room.status in ('finished', 'expired') or v_room.expires_at < now() then
    raise exception 'room_closed';
  end if;

  insert into room_members (room_id, user_id) values (v_room.id, auth.uid())
  on conflict do nothing;
  insert into events (room_id, user_id, type) values (v_room.id, auth.uid(), 'join');
  return v_room;
end $$;

-- Sorteia o tabuleiro de forma determinística pelo seed: objetivos personalizados do
-- anfitrião primeiro, o resto da biblioteca. A posição também depende do seed.
create function public.start_room(
  p_room uuid,
  p_custom_goals text[] default '{}',
  p_game_slugs text[] default null
) returns public.rooms
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
  v_n int;
  v_count int;
begin
  select * into v_room from rooms where id = p_room for update;
  if not found or not is_member(p_room) then raise exception 'not_member'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'not_host'; end if;
  if v_room.status <> 'lobby' then raise exception 'already_started'; end if;

  v_n := v_room.size * v_room.size;

  with custom as (
    select left(trim(g), 80) as goal_text, null::text as game_slug, 'misc'::text as kind, 0 as pri
      from unnest(coalesce(p_custom_goals, '{}')) g
     where char_length(trim(g)) >= 3
  ),
  lib as (
    select gt.text as goal_text, gm.slug as game_slug, gt.kind, 1 as pri
      from goal_templates gt
      left join games gm on gm.id = gt.game_id
     where (gt.is_public or gt.created_by = v_room.host_id)
       and (p_game_slugs is null or gm.slug is null or gm.slug = any (p_game_slugs))
  ),
  uniq as (
    select distinct on (goal_text) * from (select * from custom union all select * from lib) u
     order by goal_text, pri
  ),
  picked as (
    select * from uniq order by pri, md5(v_room.seed::text || goal_text) limit v_n
  )
  insert into cells (room_id, idx, goal_text, game_slug, kind)
  select p_room,
         (row_number() over (order by md5(v_room.seed::text || 'pos' || goal_text)) - 1)::smallint,
         goal_text, game_slug, kind
    from picked;

  get diagnostics v_count = row_count;
  if v_count < v_n then raise exception 'not_enough_goals'; end if;  -- a transação desfaz as cells

  update rooms
     set status = 'running',
         started_at = now(),
         ends_at = now() + make_interval(secs => duration_s)
   where id = p_room
   returning * into v_room;

  insert into events (room_id, user_id, type) values (p_room, auth.uid(), 'start');
  return v_room;
end $$;

-- ---------------------------------------------------------------- jogo

-- Conta linhas completas; ao atingir target_lines a sala vira 'finished'/'won'.
create function public.check_win(p_room uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
  v_lines int;
begin
  select * into v_room from rooms where id = p_room;
  if not found then return 0; end if;

  with idxs as (
    select i, j
      from generate_series(0, v_room.size - 1) i,
           generate_series(0, v_room.size - 1) j
  ),
  line_cells as (
    select 'r' || i as ln, i * v_room.size + j as idx from idxs
    union all select 'c' || j, i * v_room.size + j from idxs
    union all select 'd1', i * v_room.size + j from idxs where i = j
    union all select 'd2', i * v_room.size + j from idxs where i + j = v_room.size - 1
  )
  select count(*) into v_lines from (
    select lc.ln
      from line_cells lc
      left join marks m on m.room_id = p_room and m.cell_idx = lc.idx
     group by lc.ln
    having count(m.id) = v_room.size
  ) done;

  if v_lines >= v_room.target_lines and v_room.status = 'running' then
    update rooms set status = 'finished', result = 'won', finished_at = now() where id = p_room;
    insert into events (room_id, type, payload)
    values (p_room, 'win', jsonb_build_object('lines', v_lines));
  end if;
  return v_lines;
end $$;

create function public.mark_cell(p_room uuid, p_idx int) returns public.marks
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
  v_mark marks;
begin
  select * into v_room from rooms where id = p_room;
  if not found or not is_member(p_room) then raise exception 'not_member'; end if;
  if v_room.status <> 'running' or now() > v_room.ends_at then
    raise exception 'room_not_running';
  end if;

  if (select count(*) from events
       where user_id = auth.uid() and type = 'mark'
         and at > now() - interval '1 minute') >= 12 then
    raise exception 'rate_limited';
  end if;

  begin
    insert into marks (room_id, cell_idx, user_id)
    values (p_room, p_idx, auth.uid())
    returning * into v_mark;
  exception
    when unique_violation then raise exception 'already_marked';
    when foreign_key_violation then raise exception 'invalid_cell';
  end;

  insert into events (room_id, user_id, type, payload)
  values (p_room, auth.uid(), 'mark', jsonb_build_object('cell', p_idx));
  perform check_win(p_room);
  return v_mark;
end $$;

-- O cliente chama quando a contagem regressiva chega a zero.
create function public.close_if_timeout(p_room uuid) returns public.rooms
language plpgsql security definer set search_path = public as $$
declare v_room rooms;
begin
  if not is_member(p_room) then raise exception 'not_member'; end if;
  update rooms set status = 'finished', result = 'timeout', finished_at = now()
   where id = p_room and status = 'running' and ends_at < now();
  select * into v_room from rooms where id = p_room;
  return v_room;
end $$;

-- ---------------------------------------------------------------- clips

-- Chamada pelo app depois do upload. Idempotente: reenvio devolve o mesmo clip.
create function public.attach_clip(
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

  insert into clips (mark_id, room_id, user_id, storage_path, bytes, duration_ms, thumb_path, expires_at)
  values (p_mark, v_mark.room_id, auth.uid(), p_storage_path, p_bytes, p_duration_ms, p_thumb_path,
          greatest(coalesce(v_room.ends_at, now()), now()) + interval '24 hours')
  on conflict (mark_id) do update set bytes = excluded.bytes
  returning * into v_clip;

  insert into events (room_id, user_id, type, payload)
  values (v_mark.room_id, auth.uid(), 'clip', jsonb_build_object('bytes', p_bytes));
  return v_clip;
end $$;

-- Apaga a linha e devolve o caminho; o app remove o objeto pela API do Storage.
create function public.delete_my_clip(p_clip uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  delete from clips where id = p_clip and user_id = auth.uid() returning storage_path into v_path;
  if v_path is null then raise exception 'clip_not_found'; end if;
  return v_path;
end $$;

-- ---------------------------------------------------------------- permissões
-- Por padrão o Supabase libera EXECUTE para anon; fechamos e abrimos só o necessário.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.upsert_profile(text),
  public.create_room(int, int, int, text),
  public.join_room(text),
  public.start_room(uuid, text[], text[]),
  public.mark_cell(uuid, int),
  public.close_if_timeout(uuid),
  public.attach_clip(uuid, text, int, int, text),
  public.delete_my_clip(uuid),
  public.is_member(uuid),
  public.shares_room(uuid)
  to authenticated;

grant execute on function public.server_time(), public.ping() to anon, authenticated;
