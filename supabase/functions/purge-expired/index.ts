// Edge Function purge-expired: apaga clips vencidos (arquivo + miniatura + linha), arquivos órfãos,
// salas antigas e eventos com mais de 90 dias. Chamada a cada 12 h pelo GitHub Actions (keepalive.yml).
//
// Segurança: só responde com o cabeçalho `x-purge-secret` igual ao segredo PURGE_SECRET (definido nos
// Secrets das Edge Functions). Por isso o "Verify JWT" desta função fica DESLIGADO: quem protege é o segredo.
//
// Parâmetros (query string):
//   dry=1        só conta o que seria apagado
//   now=<ISO>    simula outra data (teste). Ex.: now=2026-12-01T00:00:00Z
import { createClient } from "npm:@supabase/supabase-js@2";

const BATCH = 100; // limite do remove() do Storage
const ROUNDS = 5; // até 5 x 500 clips por chamada

type Expired = { clip_id: string; storage_path: string; thumb_path: string | null };

Deno.serve(async (req) => {
  const secret = Deno.env.get("PURGE_SECRET");
  if (!secret || req.headers.get("x-purge-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const nowParam = url.searchParams.get("now");
  const now = nowParam ? new Date(nowParam) : new Date();
  if (Number.isNaN(now.getTime())) return new Response("now inválido", { status: 400 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const bucket = db.storage.from("clips");
  const report = { dry, now: now.toISOString(), expiredClips: 0, orphanObjects: 0, objectsRemoved: 0, clipRowsDeleted: 0, rooms_deleted: 0, events_deleted: 0, errors: [] as string[] };

  async function removeAll(paths: string[]): Promise<Set<string>> {
    const ok = new Set<string>();
    for (let i = 0; i < paths.length; i += BATCH) {
      const chunk = paths.slice(i, i + BATCH);
      const { error } = await bucket.remove(chunk);
      if (error) report.errors.push(`remove: ${error.message}`);
      else chunk.forEach((p) => ok.add(p));
    }
    return ok;
  }

  for (let round = 0; round < ROUNDS; round++) {
    const exp = await db.rpc("purge_list_expired", { p_now: now.toISOString(), p_limit: 500 });
    if (exp.error) {
      report.errors.push(`purge_list_expired: ${exp.error.message}`);
      break;
    }
    const clips = (exp.data ?? []) as Expired[];
    report.expiredClips += clips.length;
    if (dry || clips.length === 0) break;

    const paths = clips.flatMap((c) => [c.storage_path, ...(c.thumb_path ? [c.thumb_path] : [])]);
    const removed = await removeAll(paths);
    report.objectsRemoved += removed.size;

    // Só apaga a linha se o arquivo (e a miniatura) saíram do Storage; senão tenta de novo na próxima rodada.
    const deletable = clips.filter((c) => removed.has(c.storage_path) && (!c.thumb_path || removed.has(c.thumb_path)));
    if (deletable.length === 0) break;
    const del = await db.rpc("purge_delete_clips", { p_ids: deletable.map((c) => c.clip_id) });
    if (del.error) {
      report.errors.push(`purge_delete_clips: ${del.error.message}`);
      break;
    }
    report.clipRowsDeleted += Number(del.data ?? 0);
    if (clips.length < 500) break;
  }

  const orph = await db.rpc("purge_list_orphans", { p_now: now.toISOString(), p_limit: 500 });
  if (orph.error) report.errors.push(`purge_list_orphans: ${orph.error.message}`);
  const names = ((orph.data ?? []) as { name: string }[]).map((o) => o.name);
  report.orphanObjects = names.length;
  if (!dry && names.length > 0) report.objectsRemoved += (await removeAll(names)).size;

  if (!dry) {
    const old = await db.rpc("purge_old_rows", { p_now: now.toISOString() });
    if (old.error) report.errors.push(`purge_old_rows: ${old.error.message}`);
    else Object.assign(report, old.data);
  }

  return new Response(JSON.stringify(report, null, 2), {
    status: report.errors.length ? 207 : 200,
    headers: { "content-type": "application/json" },
  });
});
