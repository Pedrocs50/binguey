// Teste ponta a ponta automático do fluxo de clips, SÓ no app de desktop em build de debug
// e com BINGUEY_AUTOTEST=1 (ver apps/desktop/README.md). Em release `dev_config` devolve auto=false.
import { api, ensureSession, type Cell, type Clip, type Mark } from "@binguey/shared";
import { createRoomAs } from "./actions";
import { getClipStatus, captureClip } from "./clips";
import { invoke } from "./desktop";
import { navigate } from "./router";
import { renderHighlights } from "./video";
import { obs } from "./obs";
import { cleanLocalClips, connectObs, getObsState, localClipsInfo, readObsConfig } from "./obsStore";
import { supabase } from "./supabase";

interface DevConfig {
  password: string;
  auto: boolean;
  video: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function maybeRunDevAuto(): Promise<void> {
  const cfg = await invoke<DevConfig>("dev_config").catch(() => null);
  if (!cfg?.auto) return;
  const report = (line: string) => void invoke("dev_report", { line });

  try {
    await ensureSession(supabase);
    const meId = (await supabase.auth.getUser()).data.user!.id;
    const open = await supabase.from("rooms").select("id").eq("host_id", meId).eq("status", "running");
    for (const r of open.data ?? []) await api.endRoom(supabase, r.id).catch(() => {}); // salas de testes anteriores
    report("E2E: criando e iniciando uma sala de teste");
    const room = await createRoomAs("AutoTester", { size: 3, durationS: 600, targetLines: 1, clipPolicy: "optional" });
    await api.startRoom(supabase, room.id);
    report(`  sala ${room.code} em andamento`);

    // Sem OBS_PASSWORD no ambiente, a senha tem de vir da configuração do próprio OBS (sem digitar).
    const fromConfig = await readObsConfig();
    report(`  senha lida da configuração do OBS: ${fromConfig?.password ? "sim" : "NÃO"} (WebSocket ${fromConfig?.enabled ? "ativado" : "desativado"})`);
    await connectObs(cfg.password || fromConfig?.password || "", { roomId: room.id });
    const obsState = getObsState();
    if (obsState.phase !== "ready") throw new Error(`OBS não ficou pronto: ${obsState.message}`);
    report(`  OBS ${obsState.version} pronto`);
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

    // Mini-tabuleiro: a janela abre/fecha, e uma marcação vinda dele (evento) vira marca + clip.
    const shown = await invoke<boolean>("toggle_overlay");
    const hidden = await invoke<boolean>("toggle_overlay");
    report(`E2E.10 ${shown && !hidden ? "PASS" : "FAIL"}  janela do mini-tabuleiro: abriu=${shown}, fechou=${!hidden}`);
    navigate(`/r/${room.code}`);
    await sleep(2500);
    const clipsBefore = (await supabase.from("clips").select("id").eq("room_id", room.id)).data?.length ?? 0;
    const tOverlay = performance.now();
    await window.__TAURI__!.event.emit("binguey-mark", { idx: 2 });
    let viaOverlay = false;
    while (!viaOverlay && performance.now() - tOverlay < 20000) {
      const marks = (await supabase.from("marks").select("cell_idx").eq("room_id", room.id).eq("cell_idx", 2)).data?.length ?? 0;
      const clipsNow = (await supabase.from("clips").select("id").eq("room_id", room.id)).data?.length ?? 0;
      viaOverlay = marks === 1 && clipsNow > clipsBefore;
      if (!viaOverlay) await sleep(300);
    }
    report(`E2E.11 ${viaOverlay ? "PASS" : "FAIL"}  marcação enviada pelo mini-tabuleiro gerou marca e clip em ${Math.round(performance.now() - tOverlay)} ms`);

    if (cfg.video) await videoTest(report, me);

    const setup = await obs.describeSetup();
    const cap = await obs.captureSize();
    report(`E2E.5b ${cap.width > 0 && cap.height > 0 ? "PASS" : "FAIL"}  a captura do monitor recebe imagem de verdade: ${cap.width}x${cap.height} (0x0 = preto)`);
    const profileOk = /coleção=Binguey/.test(setup) && /fontes=monitor_capture/.test(setup) && /perfil=Binguey/.test(setup) && /x720@/.test(setup) && /bitrate=3000/.test(setup) && /pasta=[^ ]*Binguey /i.test(setup);
    report(`E2E.5 ${profileOk ? "PASS" : "FAIL"}  perfil dedicado: ${setup}`);
    if (getObsState().profileNote) report(`  aviso: ${getObsState().profileNote}`);

    const before = await localClipsInfo();
    const cleaned = await cleanLocalClips().catch((e) => ({ count: -1, bytes: 0, dir: String(e) }));
    const after = await localClipsInfo();
    report(
      `E2E.6 ${(before?.count ?? 0) >= 1 && cleaned.count >= 1 && after?.count === 0 ? "PASS" : "FAIL"}  arquivos locais: ` +
        `${before?.count} antes → limpou ${cleaned.count} (${(cleaned.bytes / 1024 / 1024).toFixed(1)} MB) → ${after?.count} depois`,
    );

    // Modo "só o jogo": a coleção do Binguey troca a fonte para Captura de Jogo (qualquer app em tela cheia).
    localStorage.setItem("binguey:settings", JSON.stringify({ deleteLocalAfterUpload: false, captureMode: "game" }));
    await connectObs(cfg.password || fromConfig?.password || "", { roomId: room.id });
    const gameSetup = await obs.describeSetup();
    report(`E2E.9 ${gameSetup.includes("fontes=game_capture") ? "PASS" : "FAIL"}  modo só o jogo: ${gameSetup}`);
    if (getObsState().profileNote) report(`  aviso: ${getObsState().profileNote}`);
    localStorage.setItem("binguey:settings", JSON.stringify({ deleteLocalAfterUpload: false, captureMode: "display" }));

    const ended = await api.endRoom(supabase, room.id).catch(() => null);
    report(`E2E.8 ${ended?.result === "ended" ? "PASS" : "FAIL"}  anfitrião encerra a partida (result=${ended?.result})`);

    const previous = localStorage.getItem("binguey:obs-prev-profile");
    await obs.restoreProfile();
    const restored = await obs.describeSetup();
    report(`E2E.7 ${previous && restored.includes(`perfil=${previous}`) ? "PASS" : "FAIL"}  perfil devolvido: ${restored}`);
  } catch (e) {
    report(`ERRO: ${e instanceof Error ? e.message : String(e)}`);
    await obs.restoreProfile().catch(() => {}); // deixa o OBS do jogador como estava
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

/** S5 e S6: 10 marcações com clips reais, envio ao Storage e montagem do vídeo final com o ffmpeg. */
async function videoTest(report: (line: string) => void, me: string): Promise<void> {
  const room = await createRoomAs("AutoTester", { size: 4, durationS: 900, targetLines: 10, clipPolicy: "optional" });
  await api.startRoom(supabase, room.id);
  report(`E2E.12  sala ${room.code}: marcando 10 casas com clips reais...`);

  const t0 = performance.now();
  for (let i = 0; i < 10; i++) {
    const mark = api.markCell(supabase, room.id, i).catch(() => null);
    void captureClip({ roomId: room.id, userId: me, mark });
    await sleep(2500);
  }
  let clips: Clip[] = [];
  while (clips.length < 10 && performance.now() - t0 < 300000) {
    clips = ((await supabase.from("clips").select("*").eq("room_id", room.id)).data ?? []) as Clip[];
    if (clips.length < 10) await sleep(1000);
  }
  const upSeconds = Math.round((performance.now() - t0) / 1000);
  const totalMb = clips.reduce((n, c) => n + (c.bytes ?? 0), 0) / 1024 / 1024;
  report(`E2E.12 ${clips.length === 10 ? "PASS" : "FAIL"}  ${clips.length}/10 clips no servidor em ${upSeconds} s (${totalMb.toFixed(1)} MB no total; S5)`);
  if (clips.length === 0) return;

  const [cells, marks] = await Promise.all([
    supabase.from("cells").select("*").eq("room_id", room.id),
    supabase.from("marks").select("*").eq("room_id", room.id),
  ]);
  const src = {
    room: { code: room.code, size: room.size },
    cells: (cells.data ?? []) as Cell[],
    marks: (marks.data ?? []) as Mark[],
    clips,
    nicknames: { [me]: "AutoTester" },
  };
  let lastPct = 0;
  const res = await renderHighlights(src, (p) => (lastPct = p), 10);
  const expect = clips.reduce((n, c) => n + (c.duration_ms ?? 0), 0) / 1000;
  report(
    `E2E.13 ${res.seconds < 120 && res.duration_s > expect * 0.9 && res.black_ratio < 0.5 ? "PASS" : "FAIL"}  vídeo final de ${res.duration_s.toFixed(1)} s ` +
      `(clips somam ${expect.toFixed(1)} s) montado em ${res.seconds.toFixed(1)} s com ${res.encoder}, ${(res.bytes / 1024 / 1024).toFixed(1)} MB (S6 < 120 s); ` +
      `preto: ${(res.black_ratio * 100).toFixed(0)}% do vídeo; último progresso ${lastPct}%`,
  );
  report(`  arquivo: ${res.path}`);
  await api.endRoom(supabase, room.id).catch(() => {});
}
