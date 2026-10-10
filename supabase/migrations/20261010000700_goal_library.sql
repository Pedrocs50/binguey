-- Biblioteca de objetivos. O bingo é para cumprir em QUALQUER jogo: os objetivos genéricos
-- (game_id nulo) são a base; os de jogos específicos são um extra que o anfitrião escolhe.
-- Idempotente: pode rodar de novo sem duplicar nada.

insert into public.games (slug, name) values
  ('minecraft', 'Minecraft'), ('elden-ring', 'Elden Ring'), ('hollow-knight', 'Hollow Knight'),
  ('stardew-valley', 'Stardew Valley'), ('terraria', 'Terraria'), ('hades', 'Hades'),
  ('zelda', 'The Legend of Zelda'), ('skyrim', 'Skyrim'), ('dark-souls', 'Dark Souls'),
  ('cs2', 'Counter-Strike 2'), ('fortnite', 'Fortnite'), ('lethal-company', 'Lethal Company'),
  ('celeste', 'Celeste'), ('gta-v', 'GTA V'), ('helldivers-2', 'Helldivers 2')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- genéricos (servem para qualquer jogo)
insert into public.goal_templates (game_id, text, kind, difficulty, is_public)
select null, v.text, v.kind, v.difficulty, true
from (values
  -- chefes
  ('Derrotar um chefe', 'boss', 3),
  ('Derrotar um mini-chefe', 'boss', 2),
  ('Derrotar um chefe de primeira', 'boss', 5),
  ('Derrotar um chefe sem usar cura', 'boss', 5),
  ('Sobreviver a um chefe com pouca vida', 'boss', 4),
  ('Ver a barra de vida de um chefe pela primeira vez', 'boss', 1),
  -- combate
  ('Vencer um combate sem tomar dano', 'combat', 4),
  ('Derrotar 5 inimigos seguidos sem morrer', 'combat', 2),
  ('Acertar um golpe crítico', 'combat', 2),
  ('Derrotar um inimigo pelas costas', 'combat', 2),
  ('Ser derrotado por um inimigo fraco', 'combat', 1),
  ('Derrotar um grupo de inimigos sozinho', 'combat', 3),
  ('Usar uma habilidade especial pela primeira vez', 'combat', 1),
  ('Defender ou aparar um ataque no tempo certo', 'combat', 3),
  ('Usar uma arma que você nunca usou antes', 'combat', 2),
  ('Fugir de uma luta e sobreviver', 'combat', 2),
  ('Vencer uma luta com menos de 10% de vida', 'combat', 4),
  ('Derrotar um inimigo usando o cenário', 'combat', 4),
  -- coletar
  ('Abrir um baú ou tesouro', 'collect', 1),
  ('Encontrar um item raro', 'collect', 3),
  ('Equipar um item novo', 'collect', 1),
  ('Juntar 10 unidades do mesmo recurso', 'collect', 2),
  ('Construir ou fabricar alguma coisa', 'collect', 2),
  ('Melhorar um equipamento', 'collect', 2),
  ('Encontrar dinheiro ou moeda escondida', 'collect', 1),
  ('Completar uma coleção ou conjunto de itens', 'collect', 4),
  ('Vender algo em uma loja', 'collect', 1),
  ('Comprar algo em uma loja', 'collect', 1),
  ('Achar um item que você não sabe para que serve', 'collect', 1),
  -- personagens
  ('Conversar com um NPC', 'npc', 1),
  ('Aceitar uma missão', 'npc', 1),
  ('Concluir uma missão', 'npc', 3),
  ('Ouvir um diálogo inteiro sem pular', 'npc', 2),
  ('Fazer uma escolha de diálogo importante', 'npc', 2),
  ('Dar ou receber um presente', 'npc', 1),
  ('Ajudar um personagem em apuros', 'npc', 2),
  ('Falar com 3 personagens diferentes', 'npc', 2),
  -- exploração
  ('Descobrir uma área nova', 'explore', 2),
  ('Encontrar um segredo escondido', 'explore', 4),
  ('Subir ao ponto mais alto que conseguir', 'explore', 3),
  ('Entrar numa caverna, masmorra ou prédio novo', 'explore', 1),
  ('Achar um atalho', 'explore', 2),
  ('Usar viagem rápida pela primeira vez', 'explore', 1),
  ('Abrir o mapa e se perder mesmo assim', 'explore', 1),
  ('Chegar num lugar que parece proibido', 'explore', 3),
  ('Parar para admirar uma paisagem', 'explore', 1),
  ('Nadar ou mergulhar', 'explore', 1),
  -- engraçados e do dia a dia
  ('Morrer de um jeito bobo', 'misc', 1),
  ('Cair de um lugar alto', 'misc', 2),
  ('Subir de nível', 'misc', 2),
  ('Usar um item pela primeira vez', 'misc', 1),
  ('Salvar o jogo', 'misc', 1),
  ('Errar um pulo fácil', 'misc', 1),
  ('Ficar preso em algum lugar', 'misc', 2),
  ('Morrer duas vezes no mesmo lugar', 'misc', 2),
  ('Ser pego de surpresa por um inimigo', 'misc', 1),
  ('Tirar um print de um momento engraçado', 'misc', 1),
  ('Rir alto de alguma coisa no jogo', 'misc', 1),
  ('Perder tempo em um minijogo', 'misc', 2),
  ('Mudar uma configuração do jogo', 'misc', 1),
  ('Recomeçar de um checkpoint', 'misc', 1),
  ('Jogar 10 minutos sem morrer', 'misc', 3),
  ('Tentar algo que o jogo claramente não queria', 'misc', 3),
  ('Ouvir uma música que você gostou', 'misc', 1),
  ('Assistir a uma cena ou cinemática inteira', 'misc', 1),
  ('Errar uma sequência de botões', 'misc', 2),
  ('Ficar sem munição ou recurso na hora errada', 'misc', 3),
  ('Fazer uma jogada que nem você esperava', 'misc', 3),
  -- multiplayer
  ('Vencer uma partida online', 'misc', 4),
  ('Perder uma partida por pouco', 'misc', 3),
  ('Ser o último sobrevivente de um grupo', 'misc', 4),
  -- trocar de jogo é parte da graça
  ('Jogar um jogo que você nunca tinha aberto', 'misc', 2),
  ('Ficar 15 minutos seguidos no mesmo jogo', 'misc', 2),
  ('Voltar a um jogo que já tinha jogado hoje', 'misc', 2)
) as v(text, kind, difficulty)
where not exists (
  select 1 from public.goal_templates g where g.game_id is null and g.text = v.text
);

-- ---------------------------------------------------------------- específicos de jogo (extra opcional)
insert into public.goal_templates (game_id, text, kind, difficulty, is_public)
select gm.id, v.text, v.kind, v.difficulty, true
from (values
  ('minecraft', 'Coletar 10 blocos de madeira', 'collect', 1),
  ('minecraft', 'Craftar uma picareta de ferro', 'collect', 2),
  ('minecraft', 'Derrotar um Creeper', 'combat', 1),
  ('minecraft', 'Entrar no Nether', 'explore', 4),
  ('minecraft', 'Domar um animal', 'npc', 2),
  ('elden-ring', 'Derrotar um chefe de masmorra', 'boss', 3),
  ('elden-ring', 'Acender um Sítio da Graça novo', 'explore', 1),
  ('elden-ring', 'Invocar um espírito', 'combat', 2),
  ('elden-ring', 'Falar com um NPC de Roundtable Hold', 'npc', 1),
  ('hollow-knight', 'Derrotar um chefe', 'boss', 3),
  ('hollow-knight', 'Sentar em um banco', 'explore', 1),
  ('hollow-knight', 'Comprar um amuleto', 'collect', 2),
  ('hollow-knight', 'Conversar com um bug amigável', 'npc', 1),
  ('stardew-valley', 'Colher uma plantação', 'collect', 1),
  ('stardew-valley', 'Pescar um peixe raro', 'collect', 3),
  ('stardew-valley', 'Dar um presente a um morador', 'npc', 1),
  ('stardew-valley', 'Descer 10 andares na mina', 'explore', 3),
  ('terraria', 'Derrotar o Olho de Cthulhu', 'boss', 3),
  ('terraria', 'Cavar até a caverna profunda', 'explore', 2),
  ('terraria', 'Construir uma casa para um NPC', 'npc', 2),
  ('terraria', 'Fabricar uma armadura nova', 'collect', 2),
  ('hades', 'Escapar de uma sala de chefe com a vida cheia', 'boss', 4),
  ('hades', 'Escolher uma bênção de um deus', 'misc', 1),
  ('hades', 'Conversar com alguém da Casa de Hades', 'npc', 1),
  ('hades', 'Morrer e voltar para a Casa', 'misc', 1),
  ('zelda', 'Resolver um santuário ou puzzle', 'explore', 2),
  ('zelda', 'Cozinhar uma refeição', 'collect', 1),
  ('zelda', 'Planar de um lugar alto', 'explore', 1),
  ('zelda', 'Quebrar uma arma em combate', 'misc', 1),
  ('skyrim', 'Roubar ou arrombar algo', 'misc', 2),
  ('skyrim', 'Aprender um grito de dragão', 'combat', 3),
  ('skyrim', 'Ser atacado por um gigante ou dragão', 'combat', 3),
  ('skyrim', 'Entrar em uma cidade nova', 'explore', 1),
  ('dark-souls', 'Acender uma fogueira', 'explore', 1),
  ('dark-souls', 'Morrer e perder as almas', 'misc', 1),
  ('dark-souls', 'Derrotar um chefe', 'boss', 4),
  ('dark-souls', 'Ser invadido ou invocar alguém', 'misc', 3),
  ('cs2', 'Ganhar um round', 'combat', 2),
  ('cs2', 'Fazer um ace ou jogar uma granada perfeita', 'combat', 5),
  ('cs2', 'Plantar ou desarmar a bomba', 'misc', 3),
  ('fortnite', 'Construir uma estrutura em combate', 'combat', 2),
  ('fortnite', 'Abrir um baú dourado', 'collect', 2),
  ('fortnite', 'Ficar entre os 10 últimos', 'misc', 4),
  ('lethal-company', 'Voltar para a nave com sucata', 'collect', 2),
  ('lethal-company', 'Escapar de um monstro por pouco', 'combat', 3),
  ('lethal-company', 'Perder um colega para um monstro', 'misc', 2),
  ('celeste', 'Completar uma tela sem morrer', 'explore', 3),
  ('celeste', 'Pegar um morango', 'collect', 2),
  ('celeste', 'Usar o dash no momento exato', 'misc', 1),
  ('gta-v', 'Fugir da polícia', 'misc', 3),
  ('gta-v', 'Dirigir por um atalho absurdo', 'explore', 2),
  ('gta-v', 'Concluir uma missão da história', 'npc', 3),
  ('helldivers-2', 'Completar um objetivo da missão', 'combat', 2),
  ('helldivers-2', 'Pedir um reforço e ser salvo por ele', 'misc', 2),
  ('helldivers-2', 'Acertar um aliado sem querer', 'misc', 1)
) as v(slug, text, kind, difficulty)
join public.games gm on gm.slug = v.slug
where not exists (
  select 1 from public.goal_templates g where g.game_id = gm.id and g.text = v.text
);

-- ---------------------------------------------------------------- sorteio: genéricos por padrão
-- Sem escolher jogos, o tabuleiro usa SÓ objetivos que servem para qualquer jogo. Escolhendo jogos,
-- entram também os objetivos deles. Objetivos próprios do anfitrião vêm primeiro.
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
