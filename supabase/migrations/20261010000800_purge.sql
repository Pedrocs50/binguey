-- Limpeza automática. A Edge Function purge-expired (supabase/functions/purge-expired) usa estas funções
-- com a service role: lista o que venceu, apaga os ARQUIVOS pela API do Storage (SQL só apagaria o
-- registro, deixando o arquivo órfão) e só depois apaga as linhas.
-- Todas aceitam um "agora" explícito: serve para simular datas futuras nos testes (só a service role chama).

-- Clips vencidos (expires_at passou).
create function public.purge_list_expired(p_now timestamptz default now(), p_limit int default 500)
returns table (clip_id uuid, storage_path text, thumb_path text)
language sql security definer set search_path = public as $$
  select id, storage_path, thumb_path
    from clips
   where expires_at < p_now
   order by expires_at
   limit p_limit;
$$;

-- Arquivos no bucket sem clip correspondente (upload sem attach_clip, clip apagado pela sala, etc.),
-- com 24 h de tolerância para não apagar um upload em andamento.
create function public.purge_list_orphans(p_now timestamptz default now(), p_limit int default 500)
returns table (name text)
language sql security definer set search_path = public as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'clips'
     and o.created_at < p_now - interval '24 hours'
     and not exists (select 1 from clips c where c.storage_path = o.name or c.thumb_path = o.name)
   limit p_limit;
$$;

-- Remove as linhas dos clips cujos arquivos já foram apagados.
create function public.purge_delete_clips(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from clips where id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Salas antigas (7 dias depois de expirar, em cascata: membros, casas, marcações) e eventos com mais de 90 dias.
create function public.purge_old_rows(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rooms int;
  v_events int;
begin
  update rooms set status = 'finished', result = 'timeout', finished_at = p_now
   where status = 'running' and ends_at < p_now;
  update rooms set status = 'expired' where status <> 'expired' and expires_at < p_now;

  delete from rooms where expires_at < p_now - interval '7 days';
  get diagnostics v_rooms = row_count;
  delete from events where at < p_now - interval '90 days';
  get diagnostics v_events = row_count;
  return jsonb_build_object('rooms_deleted', v_rooms, 'events_deleted', v_events);
end $$;

revoke execute on function
  public.purge_list_expired(timestamptz, int),
  public.purge_list_orphans(timestamptz, int),
  public.purge_delete_clips(uuid[]),
  public.purge_old_rows(timestamptz)
  from public, anon, authenticated;
grant execute on function
  public.purge_list_expired(timestamptz, int),
  public.purge_list_orphans(timestamptz, int),
  public.purge_delete_clips(uuid[]),
  public.purge_old_rows(timestamptz)
  to service_role;
