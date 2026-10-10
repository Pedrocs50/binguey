// Teste ponta a ponta automático do fluxo de clips, SÓ no app de desktop em build de debug
// e com BINGUEY_AUTOTEST=1 (ver apps/desktop/README.md). Em release `dev_config` devolve auto=false.
import { api } from "@binguey/shared";
import { createRoomAs } from "./actions";
import { getClipStatus, captureClip } from "./clips";
import { invoke } from "./desktop";
import { connectObs, getObsState } from "./obsStore";
import { supabase } from "./supabase";

interface DevConfig {
  password: string;
  auto: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function maybeRunDevAuto(): Promise<void> {
  const cfg = await invoke<DevConfig>("dev_config").catch(() => null);
  if (!cfg?.auto) return;
  const report = (line: string) => void invoke("dev_report", { line });

  try {
    report("E2E: criando e iniciando uma sala de teste");
    const room = await createRoomAs("AutoTester", { size: 3, durationS: 600, targetLines: 1, clipPolicy: "optional" });
    await api.startRoom(supabase, room.id);
    report(`  sala ${room.code} em andamento`);

    await connectObs(cfg.password, { roomId: room.id });
    const obs = getObsState();
    if (obs.phase !== "ready") throw new Error(`OBS não ficou pronto: ${obs.message}`);
    report(`  OBS ${obs.version} pronto`);
    await sleep(1500);

    const me = (await supabase.auth.getUser()).data.user!.id;
    const t0 = performance.now();
    const mark = api.markCell(supabase, room.id, 4).catch(() => null);
    void captureClip({ roomId: room.id, userId: me, mark });

    let clip: { storage_path: string; thumb_path: string | null; bytes: number | null; duration_ms: number | null } | null = null;
    while (!clip && performance.now() - t0 < 40000) {
      const r = await supabase.from("clips").select("storage_path, thumb_path, bytes, duration_ms").eq("room_id", room.id).limit(1);
      clip = r.data?.[0] ?? null;
      if (!clip) await sleep(300);
    }
    if (!clip) throw new Error(`o clip não apareceu em 40 s (${JSON.stringify(getClipStatus())})`);
    const ms = Math.round(performance.now() - t0);
    report(
      `E2E.1 ${ms <= 10000 ? "PASS" : "FAIL"}  clip visível na sala em ${ms} ms (meta ≤ 10000) · ` +
        `${((clip.bytes ?? 0) / 1024 / 1024).toFixed(2)} MB · duração ${clip.duration_ms} ms · miniatura ${clip.thumb_path ? "sim" : "NÃO"}`,
    );

    const signed = await supabase.storage.from("clips").createSignedUrl(clip.storage_path, 60);
    if (!signed.data) throw new Error(`URL assinada falhou: ${signed.error?.message}`);
    const res = await fetch(signed.data.signedUrl, { headers: { Range: "bytes=0-1023" } });
    const head = new Uint8Array(await res.arrayBuffer());
    const ftyp = new TextDecoder().decode(head.slice(4, 8));
    report(`E2E.2 ${res.ok && ftyp === "ftyp" ? "PASS" : "FAIL"}  download por URL assinada: HTTP ${res.status}, ftyp=${ftyp}`);

    const members = await supabase.from("room_members").select("clips_active").eq("room_id", room.id);
    report(`E2E.3 ${members.data?.[0]?.clips_active ? "PASS" : "WARN"}  clips_active=${members.data?.[0]?.clips_active} (WARN = migration 0005 não aplicada)`);

    const dup = await captureOnLostMark(room.id, me);
    report(`E2E.4 ${dup ? "PASS" : "FAIL"}  marcação perdida não gera clip`);
  } catch (e) {
    report(`ERRO: ${e instanceof Error ? e.message : String(e)}`);
  }
  report("FIM");
  await invoke("dev_exit");
}

/** Marca de novo a mesma casa (vai falhar com already_marked) e confere que nenhum clip novo entra. */
async function captureOnLostMark(roomId: string, me: string): Promise<boolean> {
  const before = (await supabase.from("clips").select("id").eq("room_id", roomId)).data?.length ?? 0;
  const mark = api.markCell(supabase, roomId, 4).catch(() => null);
  await captureClip({ roomId, userId: me, mark });
  await sleep(2500);
  const after = (await supabase.from("clips").select("id").eq("room_id", roomId)).data?.length ?? 0;
  return after === before;
}
