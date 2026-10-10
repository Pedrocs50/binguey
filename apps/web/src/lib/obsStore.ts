import { useSyncExternalStore } from "react";
import { api } from "@binguey/shared";
import { invoke, isDesktop } from "./desktop";
import { obs, ObsError } from "./obs";
import { getObsPassword, getSettings, setObsPassword } from "./storage";
import { supabase } from "./supabase";

export type ObsPhase = "off" | "connecting" | "ready" | "error";

export interface ObsState {
  phase: ObsPhase;
  message: string;
  version: string;
  /** Tamanho (MB) do clip de teste, depois de "conectar e testar". */
  testMb: number | null;
  /** Aviso (não é erro): a cena grava o monitor inteiro em vez de só o jogo. */
  captureWarning: string;
  /** Aviso (não é erro): o perfil dedicado não pôde ser preparado. */
  profileNote: string;
}

let state: ObsState = { phase: "off", message: "", version: "", testMb: null, captureWarning: "", profileNote: "" };
const listeners = new Set<() => void>();

function set(next: Partial<ObsState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const getObsState = () => state;
export const useObsState = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );

obs.onClose = () => set({ phase: "error", message: "A conexão com o OBS caiu. Reconecte." });

function describe(e: unknown): string {
  return e instanceof ObsError || e instanceof Error ? e.message : "Erro desconhecido ao falar com o OBS.";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Conecta; se o OBS não estiver aberto, abre (instalação padrão) e espera ele responder. */
async function connectOrLaunch(password: string): Promise<void> {
  try {
    await obs.connect(password);
    return;
  } catch (e) {
    if (!(e instanceof ObsError) || e.code !== "unreachable") throw e;
  }

  try {
    await invoke<string>("launch_obs");
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (reason === "ja_aberto")
      throw new ObsError(
        "unreachable",
        "O OBS está aberto, mas o WebSocket não responde. No OBS: Ferramentas → Configurações do servidor WebSocket → ativar (porta 4455).",
      );
    if (reason === "nao_encontrado")
      throw new ObsError("unreachable", "OBS não encontrado. Instale em obsproject.com e tente de novo.");
    throw new ObsError("unreachable", reason);
  }

  set({ message: "Abrindo o OBS…" });
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      await obs.connect(password);
      return;
    } catch (e) {
      if (!(e instanceof ObsError) || e.code !== "unreachable") throw e;
    }
  }
  throw new ObsError(
    "unreachable",
    "Abri o OBS, mas ele não respondeu em 30 s. Confira se o servidor WebSocket está ativado nas configurações dele.",
  );
}

/**
 * Conecta ao OBS, prepara o Replay Buffer e, se `test`, grava um clip de teste.
 * Em qualquer caso avisa a sala (set_clips_active) quando `roomId` é informado.
 */
export async function connectObs(password: string, opts: { test?: boolean; roomId?: string } = {}): Promise<void> {
  if (!isDesktop()) return;
  set({ phase: "connecting", message: "Conectando ao OBS…" });
  try {
    await connectOrLaunch(password);
    await obs.prepare();
    let testMb: number | null = null;
    if (opts.test) {
      const file = await obs.saveReplay();
      const bytes = await invoke<ArrayBuffer>("read_clip", { path: file });
      testMb = bytes.byteLength / 1024 / 1024;
    }
    setObsPassword(password);
    const kinds = await obs.activeCaptureKinds();
    const mode = getSettings().captureMode;
    const captureWarning = !kinds.includes("monitor_capture")
      ? ""
      : mode === "display"
        ? "Gravando o monitor principal: funciona com qualquer jogo, mas notificações, Discord e outras janelas também aparecem nos clips. Para gravar só o jogo, escolha “só o jogo em tela cheia”."
        : "A sua cena do OBS grava o monitor inteiro: notificações e outras janelas aparecem nos clips.";
    set({
      phase: "ready",
      message: "",
      version: obs.obsVersion,
      testMb: testMb ?? state.testMb,
      captureWarning,
      profileNote: obs.profileNote,
    });
    if (opts.roomId) await announceClips(opts.roomId, true);
  } catch (e) {
    // Se falhou depois de trocar o perfil, devolve o do jogador: o OBS fica como estava.
    await obs.restoreProfile().catch(() => {});
    set({ phase: "error", message: describe(e) });
    if (opts.roomId) await announceClips(opts.roomId, false);
  }
}

/** Desativa os clips: devolve o perfil do OBS que o jogador usava e desconecta. */
export async function disconnectObs(roomId?: string): Promise<void> {
  if (roomId) void announceClips(roomId, false);
  await obs.restoreProfile();
  obs.close();
  set({ phase: "off", message: "", testMb: null, captureWarning: "", profileNote: "" });
}

export interface LocalClips {
  dir: string;
  count: number;
  bytes: number;
}

export const localClipsInfo = () => invoke<LocalClips>("local_clips_info").catch(() => null);
export const cleanLocalClips = () => invoke<LocalClips>("clean_local_clips");
export const openClipsDir = () => invoke<void>("open_clips_dir").catch(() => {});

/** Avisa a sala quem está com clips ativos. Melhor esforço: o jogo não depende disso. */
export async function announceClips(roomId: string, active: boolean): Promise<void> {
  try {
    await api.setClipsActive(supabase, roomId, active);
  } catch {
    /* migration 0005 ainda não aplicada, ou sem rede: ignora */
  }
}

export interface ObsWebsocketConfig {
  enabled: boolean;
  port: number;
  auth_required: boolean;
  password: string;
}

/** Configuração do WebSocket que o próprio OBS guarda no disco (null se não achar). */
export async function readObsConfig(): Promise<ObsWebsocketConfig | null> {
  if (!isDesktop()) return null;
  return invoke<ObsWebsocketConfig>("read_obs_websocket_config").catch(() => null);
}

/**
 * Reconecta sozinho ao entrar na sala. A senha vem do que o usuário já usou ou, na primeira vez,
 * direto da configuração do OBS: ninguém precisa digitá-la.
 */
export async function autoConnectObs(roomId?: string): Promise<void> {
  if (!isDesktop() || state.phase === "connecting" || state.phase === "ready") return;
  const cfg = await readObsConfig();
  const password = getObsPassword() || cfg?.password || "";
  if (!password && cfg?.auth_required !== false) return; // sem senha para tentar: o painel pede
  void connectObs(password, { roomId });
}
