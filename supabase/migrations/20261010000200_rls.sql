-- Segurança por linha. Sem políticas de INSERT/UPDATE/DELETE: o cliente só escreve via RPC.

create function public.is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members where room_id = p_room and user_id = auth.uid()
  );
$$;

-- Verdadeiro se o usuário atual divide alguma sala com p_user (para ler apelidos).
create function public.shares_room(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or exists (
    select 1
    from room_members a
    join room_members b on b.room_id = a.room_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

alter table public.profiles       enable row level security;
alter table public.games          enable row level security;
alter table public.goal_templates enable row level security;
alter table public.rooms          enable row level security;
alter table public.room_members   enable row level security;
alter table public.cells          enable row level security;
alter table public.marks          enable row level security;
alter table public.clips          enable row level security;
alter table public.events         enable row level security;  -- sem policy: só service role / views

create policy profiles_read on public.profiles for select to authenticated
  using (public.shares_room(id));
create policy games_read on public.games for select to authenticated using (true);
create policy goals_read on public.goal_templates for select to authenticated
  using (is_public or created_by = auth.uid());
create policy rooms_read on public.rooms for select to authenticated
  using (public.is_member(id));
create policy members_read on public.room_members for select to authenticated
  using (public.is_member(room_id));
create policy cells_read on public.cells for select to authenticated
  using (public.is_member(room_id));
create policy marks_read on public.marks for select to authenticated
  using (public.is_member(room_id));
create policy clips_read on public.clips for select to authenticated
  using (public.is_member(room_id));

-- Permissões explícitas (o projeto é criado com "Automatically expose new tables" desligado,
-- mas o resultado não depende disso). Anon não toca em tabela nenhuma; authenticated só LÊ,
-- e mesmo assim filtrado pelas policies acima. Escrita: apenas via RPC. `events`: ninguém.
revoke all on all tables in schema public from anon, authenticated;
grant select on
  public.profiles, public.games, public.goal_templates, public.rooms,
  public.room_members, public.cells, public.marks, public.clips
  to authenticated;
