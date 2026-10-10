-- O anfitrião pode encerrar a partida antes da vitória ou do fim do tempo.

alter table public.rooms drop constraint if exists rooms_result_check;
alter table public.rooms
  add constraint rooms_result_check check (result in ('won', 'timeout', 'ended'));

create function public.end_room(p_room uuid) returns public.rooms
language plpgsql security definer set search_path = public as $$
declare v_room rooms;
begin
  select * into v_room from rooms where id = p_room for update;
  if not found or not is_member(p_room) then raise exception 'not_member'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'not_host'; end if;
  if v_room.status <> 'running' then raise exception 'room_not_running'; end if;

  update rooms set status = 'finished', result = 'ended', finished_at = now()
   where id = p_room returning * into v_room;
  insert into events (room_id, user_id, type) values (p_room, auth.uid(), 'end');
  return v_room;
end $$;

revoke execute on function public.end_room(uuid) from public, anon;
grant execute on function public.end_room(uuid) to authenticated;
