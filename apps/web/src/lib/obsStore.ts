import { useSyncExternalStore } from "react";
import { api } from "@binguey/shared";
import { invoke, isDesktop } from "./desktop";
import { obs, ObsError } from "./obs";
import { getObsPassword, setObsPassword } from "./storage";
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
}

let state: ObsState = { phase: "off", message: "", version: "", testMb: null, captureWarning: "" };
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

/**
 * Conecta ao OBS, prepara o Replay Buffer e, se `test`, grava um clip de teste.
 * Em qualquer caso avisa a sala (set_clips_active) quando `roomId` é informado.
 */
export async function connectObs(password: string, opts: { test?: boolean; roomId?: string } = {}): Promise<void> {
  if (!isDesktop()) return;
  set({ phase: "connecting", message: "Conectando ao OBS…" });
  try {
    await obs.connect(password);
    await obs.prepare();
    let testMb: number | null = null;
    if (opts.test) {
      const file = await obs.saveReplay();
      const bytes = await invoke<ArrayBuffer>("read_clip", { path: file });
      testMb = bytes.byteLength / 1024 / 1024;
    }
    setObsPassword(password);
    const kinds = await obs.activeCaptureKinds();
    const captureWarning = kinds.includes("monitor_capture")
      ? "A cena do OBS grava o monitor inteiro: notificações, Discord e outras janelas aparecem nos clips. Para jogos, prefira “Captura de Jogo” (Fontes → + → Captura de Jogo)."
      : "";
    set({ phase: "ready", message: "", version: obs.obsVersion, testMb: testMb ?? state.testMb, captureWarning });
    if (opts.roomId) await announceClips(opts.roomId, true);
  } catch (e) {
    set({ phase: "error", message: describe(e) });
    if (opts.roomId) await announceClips(opts.roomId, false);
  }
}

export function disconnectObs(roomId?: string) {
  obs.close();
  set({ phase: "off", message: "", testMb: null, captureWarning: "" });
  if (roomId) void announceClips(roomId, false);
}

/** Avisa a sala quem está com clips ativos. Melhor esforço: o jogo não depende disso. */
export async function announceClips(roomId: string, active: boolean): Promise<void> {
  try {
    await api.setClipsActive(supabase, roomId, active);
  } catch {
    /* migration 0005 ainda não aplicada, ou sem rede: ignora */
  }
}

/** Reconecta sozinho, na abertura do app, se já houver uma senha guardada. */
export function autoConnectObs(roomId?: string) {
  const saved = getObsPassword();
  if (!isDesktop() || !saved || state.phase === "connecting" || state.phase === "ready") return;
  void connectObs(saved, { roomId });
}
