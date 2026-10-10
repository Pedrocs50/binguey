-- Binguey: esquema base. Toda escrita do cliente passa por RPC (ver 0003_rpc).

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  created_at timestamptz not null default now()
);

create table public.games (
  id serial primary key,
  slug text unique not null,
  name text not null
);

create table public.goal_templates (
  id uuid primary key default gen_random_uuid(),
  game_id int references public.games,           -- null = objetivo genérico
  text text not null check (char_length(text) between 3 and 80),
  kind text check (kind in ('boss','collect','npc','explore','combat','misc')),
  difficulty smallint check (difficulty between 1 and 5),
  created_by uuid references public.profiles,
  is_public boolean not null default false
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                      -- 6 caracteres, sem 0/O/1/I
  host_id uuid not null references public.profiles,
  size smallint not null default 4 check (size in (3, 4, 5)),
  status text not null default 'lobby'
    check (status in ('lobby', 'running', 'finished', 'expired')),
  result text check (result in ('won', 'timeout')),
  seed bigint not null,
  duration_s int not null default 3600 check (duration_s between 300 and 14400),
  target_lines smallint not null default 2 check (target_lines >= 1),
  clip_policy text not null default 'optional'
    check (clip_policy in ('off', 'optional', 'required')),
  started_at timestamptz,
  ends_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default now() + interval '48 hours'
);

create table public.room_members (
  room_id uuid references public.rooms on delete cascade,
  user_id uuid references public.profiles,
  clips_active boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.cells (                       -- tabuleiro congelado da sala
  room_id uuid references public.rooms on delete cascade,
  idx smallint,
  goal_text text not null,
  game_slug text,
  kind text,
  primary key (room_id, idx)
);

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  cell_idx smallint not null,
  user_id uuid not null references public.profiles,
  marked_at timestamptz not null default now(),
  unique (room_id, cell_idx),                     -- primeiro a marcar vence
  foreign key (room_id, cell_idx) references public.cells (room_id, idx) on delete cascade
);

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  mark_id uuid unique references public.marks on delete cascade,
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid not null references public.profiles,
  storage_path text not null,                     -- nome do objeto no bucket 'clips'
  bytes int,
  duration_ms int,
  thumb_path text,
  expires_at timestamptz not null default now() + interval '48 hours'
);

create table public.events (                      -- log append-only para analytics e rate limit
  id bigint generated always as identity primary key,
  room_id uuid,
  user_id uuid,
  type text not null,
  payload jsonb not null default '{}',
  at timestamptz not null default now()
);

create index on public.events (room_id, at);
create index on public.events (user_id, type, at);
create index on public.rooms (expires_at);
create index on public.clips (expires_at);
create index on public.room_members (user_id);
