-- Como a sala vence: 'lines' (completar N linhas) ou 'full' (cartela cheia: todas as casas marcadas).

alter table public.rooms
  add column win_mode text not null default 'lines' check (win_mode in ('lines', 'full'));

-- Troca a assinatura de create_room (ganha p_win_mode). O drop evita ficarem duas versões da função,
-- o que deixaria a chamada ambígua para o PostgREST.
drop function if exists public.create_room(int, int, int, text);

create function public.create_room(
  p_size int default 4,
  p_duration_s int default 3600,
  p_target_lines int default 2,
  p_clip_policy text default 'optional',
  p_win_mode text default 'lines'
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
  if p_win_mode not in ('lines', 'full') then raise exception 'invalid_win_mode'; end if;
  if p_win_mode = 'lines' and (p_target_lines < 1 or p_target_lines > 2 * p_size + 2) then
    raise exception 'invalid_target_lines';
  end if;
  if p_clip_policy not in ('off', 'optional', 'required') then
    raise exception 'invalid_clip_policy';
  end if;
  if (select count(*) from rooms
       where host_id = auth.uid() and status in ('lobby', 'running')) >= 3 then
    raise exception 'too_many_rooms';
  end if;

  insert into rooms (code, host_id, size, seed, duration_s, target_lines, clip_policy, win_mode)
  values (generate_room_code(), auth.uid(), p_size, (random() * 9e15)::bigint,
          p_duration_s, case when p_win_mode = 'full' then 1 else p_target_lines end, p_clip_policy, p_win_mode)
  returning * into v_room;

  insert into room_members (room_id, user_id) values (v_room.id, auth.uid());
  insert into events (room_id, user_id, type, payload)
  values (v_room.id, auth.uid(), 'room_created',
          jsonb_build_object('size', p_size, 'target_lines', p_target_lines, 'win_mode', p_win_mode));
  return v_room;
end $$;

revoke execute on function public.create_room(int, int, int, text, text) from public, anon;
grant execute on function public.create_room(int, int, int, text, text) to authenticated;

-- check_win: no modo 'full' a sala vence quando todas as casas estão marcadas.
create or replace function public.check_win(p_room uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
  v_lines int;
  v_marks int;
  v_done boolean;
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

  select count(*) into v_marks from marks where room_id = p_room;
  v_done := case
              when v_room.win_mode = 'full' then v_marks >= v_room.size * v_room.size
              else v_lines >= v_room.target_lines
            end;

  if v_done and v_room.status = 'running' then
    update rooms set status = 'finished', result = 'won', finished_at = now() where id = p_room;
    insert into events (room_id, type, payload)
    values (p_room, 'win', jsonb_build_object('lines', v_lines, 'marks', v_marks, 'win_mode', v_room.win_mode));
  end if;
  return v_lines;
end $$;
