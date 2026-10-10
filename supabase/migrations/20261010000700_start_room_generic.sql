-- Sorteio do tabuleiro: por padrão só objetivos genéricos (servem para qualquer jogo).
-- Escolhendo jogos, entram também os objetivos específicos deles. Objetivos próprios do
-- anfitrião vêm primeiro. A biblioteca em si vive em supabase/seed.sql (gerado de supabase/goals/).

create or replace function public.start_room(
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
       and (gt.game_id is null or gm.slug = any (coalesce(p_game_slugs, '{}')))
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
  if v_count < v_n then raise exception 'not_enough_goals'; end if;

  update rooms
     set status = 'running',
         started_at = now(),
         ends_at = now() + make_interval(secs => duration_s)
   where id = p_room
   returning * into v_room;

  insert into events (room_id, user_id, type) values (p_room, auth.uid(), 'start');
  return v_room;
end $$;
