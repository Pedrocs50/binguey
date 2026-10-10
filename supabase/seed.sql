-- Biblioteca inicial de objetivos (só roda em `supabase db reset`). game_id nulo = genérico.

insert into public.games (slug, name) values
  ('minecraft', 'Minecraft'),
  ('elden-ring', 'Elden Ring'),
  ('hollow-knight', 'Hollow Knight'),
  ('stardew-valley', 'Stardew Valley');

insert into public.goal_templates (game_id, text, kind, difficulty, is_public)
select null, t.text, t.kind, t.difficulty, true
from (values
  ('Derrotar um chefe', 'boss', 3),
  ('Morrer de um jeito bobo', 'misc', 1),
  ('Conversar com um NPC', 'npc', 1),
  ('Abrir um baú ou tesouro', 'collect', 1),
  ('Descobrir uma área nova', 'explore', 2),
  ('Vencer um combate sem tomar dano', 'combat', 4),
  ('Comprar algo em uma loja', 'misc', 1),
  ('Subir de nível', 'misc', 2),
  ('Encontrar um segredo escondido', 'explore', 4),
  ('Usar um item pela primeira vez', 'misc', 1),
  ('Cair de um lugar alto', 'misc', 2),
  ('Salvar o jogo', 'misc', 1)
) as t(text, kind, difficulty);

insert into public.goal_templates (game_id, text, kind, difficulty, is_public)
select g.id, t.text, t.kind, t.difficulty, true
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
  ('stardew-valley', 'Descer 10 andares na mina', 'explore', 3)
) as t(slug, text, kind, difficulty)
join public.games g on g.slug = t.slug;
