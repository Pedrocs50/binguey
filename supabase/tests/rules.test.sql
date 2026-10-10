-- pgTAP: regras de jogo e permissões. Rodar com `supabase test db`.
-- AINDA NÃO EXECUTADO (sem Docker/Supabase CLI na máquina de origem): validar na Fase 0.
begin;
select plan(9);

insert into auth.users (id, aud, role, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', true),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', true),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', true);

create function pg_temp.act_as(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- A cria a sala, B entra, C é de fora.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select upsert_profile('Alice')$$, 'A cria perfil');
select lives_ok($$select create_room(3, 600, 1, 'off')$$, 'A cria sala 3x3 com 1 linha-alvo');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$select upsert_profile('Bruno')$$, 'B cria perfil');
select is((select count(*)::int from public.rooms), 0, 'B ainda não enxerga a sala (RLS)');

-- Código da sala lido como A.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select set_config('app.code', (select code from public.rooms limit 1), true);
select set_config('app.room', (select id::text from public.rooms limit 1), true);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$select join_room(current_setting('app.code'))$$, 'B entra pelo código');

-- A inicia com 9 objetivos personalizados.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$select start_room(current_setting('app.room')::uuid,
      array['obj 1','obj 2','obj 3','obj 4','obj 5','obj 6','obj 7','obj 8','obj 9'])$$,
  'A inicia a partida');

-- Primeiro a marcar vence: B tenta a mesma casa que A.
select lives_ok($$select mark_cell(current_setting('app.room')::uuid, 0)$$, 'A marca a casa 0');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select mark_cell(current_setting('app.room')::uuid, 0)$$,
  'P0001', 'already_marked', 'B não marca a casa 0 de novo');

-- C, de fora, não enxerga a sala.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.rooms), 0, 'C não lê salas alheias');

select * from finish();
rollback;
