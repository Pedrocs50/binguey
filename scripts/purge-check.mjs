// Chama a Edge Function purge-expired. Sem argumento: simulação (dry=1) com a data de agora.
// Com uma data (AAAA-MM-DD): simula esse "agora"; acrescente --apply para APAGAR de verdade.
//   node --env-file=.env.local scripts/purge-check.mjs
//   node --env-file=.env.local scripts/purge-check.mjs 2026-12-01
//   node --env-file=.env.local scripts/purge-check.mjs 2026-12-01 --apply
const base = process.env.VITE_SUPABASE_URL;
const secret = process.env.PURGE_SECRET;
if (!base || !secret) throw new Error("Defina VITE_SUPABASE_URL e PURGE_SECRET no .env.local");

const date = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}/.test(a));
const apply = process.argv.includes("--apply");
const params = new URLSearchParams();
if (!apply) params.set("dry", "1");
if (date) params.set("now", new Date(date).toISOString());

const res = await fetch(`${base}/functions/v1/purge-expired?${params}`, { method: "POST", headers: { "x-purge-secret": secret } });
console.log(`HTTP ${res.status}`);
console.log(await res.text());
process.exit(res.ok ? 0 : 1);
