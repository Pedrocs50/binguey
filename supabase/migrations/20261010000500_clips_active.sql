-- O app informa à sala que o jogador está com o OBS pronto ("[clips ativos]").

create function public.set_clips_active(p_room uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_room) then raise exception 'not_member'; end if;
  update room_members set clips_active = p_active
   where room_id = p_room and user_id = auth.uid();
end $$;

revoke execute on function public.set_clips_active(uuid, boolean) from public, anon;
grant execute on function public.set_clips_active(uuid, boolean) to authenticated;
