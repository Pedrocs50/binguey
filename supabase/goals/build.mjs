// Valida supabase/goals/library.mjs e gera supabase/seed.sql (idempotente).
// Uso: node supabase/goals/build.mjs
//
// O seed.sql gerado:
//  - cria os jogos e os objetivos que ainda não existem;
//  - atualiza tipo e dificuldade dos que mudaram;
//  - REMOVE objetivos do sistema que saíram da biblioteca (os criados por usuários nunca são tocados);
//  - pode rodar quantas vezes quiser (no Supabase: SQL Editor → colar → Run).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { games, generic } from "./library.mjs";

const KINDS = { B: "boss", C: "combat", L: "collect", N: "npc", E: "explore", M: "misc" };
const errors = [];
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

function check(scope, list) {
  const seen = new Set();
  for (const [text, kind, diff] of list) {
    if (typeof text !== "string" || text.length < 3 || text.length > 80) errors.push(`${scope}: tamanho inválido (${text?.length}): ${text}`);
    if (!KINDS[kind]) errors.push(`${scope}: tipo inválido "${kind}": ${text}`);
    if (!Number.isInteger(diff) || diff < 1 || diff > 5) errors.push(`${scope}: dificuldade inválida (${diff}): ${text}`);
    if (seen.has(text.toLowerCase())) errors.push(`${scope}: repetido: ${text}`);
    seen.add(text.toLowerCase());
  }
}

check("genérico", generic);
const slugs = new Set();
for (const g of games) {
  if (slugs.has(g.slug)) errors.push(`jogo repetido: ${g.slug}`);
  slugs.add(g.slug);
  if (!/^[a-z0-9-]+$/.test(g.slug)) errors.push(`slug inválido: ${g.slug}`);
  if (g.goals.length < 5) errors.push(`${g.slug}: poucos objetivos (${g.goals.length}); mínimo 5`);
  check(g.slug, g.goals);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const rows = [
  ...generic.map(([t, k, d]) => `(null, ${q(t)}, ${q(KINDS[k])}, ${d})`),
  ...games.flatMap((g) => g.goals.map(([t, k, d]) => `(${q(g.slug)}, ${q(t)}, ${q(KINDS[k])}, ${d})`)),
];

const sql = `-- GERADO por supabase/goals/build.mjs a partir de supabase/goals/library.mjs. Não edite à mão.
-- Idempotente: cria o que falta, atualiza o que mudou e remove objetivos do sistema que saíram da lista.
-- Objetivos criados por usuários (created_by não nulo) nunca são tocados.
begin;

insert into public.games (slug, name) values
${games.map((g) => `  (${q(g.slug)}, ${q(g.name)})`).join(",\n")}
on conflict (slug) do update set name = excluded.name;

create temp table _lib (slug text, text text, kind text, difficulty smallint) on commit drop;
insert into _lib values
${rows.map((r) => "  " + r).join(",\n")};

insert into public.goal_templates (game_id, text, kind, difficulty, is_public)
select g.id, l.text, l.kind, l.difficulty, true
  from _lib l
  left join public.games g on g.slug = l.slug
 where not exists (
   select 1 from public.goal_templates t
    where t.game_id is not distinct from g.id and t.text = l.text and t.created_by is null);

update public.goal_templates t
   set kind = l.kind, difficulty = l.difficulty, is_public = true
  from _lib l
  left join public.games g on g.slug = l.slug
 where t.created_by is null and t.game_id is not distinct from g.id and t.text = l.text
   and (t.kind, t.difficulty, t.is_public) is distinct from (l.kind, l.difficulty, true);

delete from public.goal_templates t
 where t.created_by is null
   and not exists (
     select 1 from _lib l
       left join public.games g on g.slug = l.slug
      where t.game_id is not distinct from g.id and t.text = l.text);

commit;
`;

const out = fileURLToPath(new URL("../seed.sql", import.meta.url));
writeFileSync(out, sql);

const byKind = {};
for (const [, k] of generic) byKind[KINDS[k]] = (byKind[KINDS[k]] ?? 0) + 1;
const specific = games.reduce((n, g) => n + g.goals.length, 0);
console.log(`seed.sql gerado: ${generic.length} genéricos (${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(", ")}),`);
console.log(`${games.length} jogos com ${specific} objetivos específicos. Total: ${generic.length + specific}.`);
