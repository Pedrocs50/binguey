import { useSyncExternalStore } from "react";
import { api, BingueyError, type Mark } from "@binguey/shared";
import { invoke } from "./desktop";
import { obs } from "./obs";
import { getSettings } from "./storage";
import { errorMessage } from "./errors";
import { supabase } from "./supabase";

/**
 * Espera curta depois do clique antes de salvar. O jogador cumpre o objetivo no jogo e só depois volta ao
 * app para marcar; o que importa está ANTES do clique (o buffer guarda 20 s), então não esperamos mais.
 */
export const POST_ROLL_MS = 500;
const QUEUE_KEY = "binguey:clipQueue";
const MAX_ATTEMPTS = 5;
/** Erros do servidor que não adianta repetir: descarta o item da fila. */
const FATAL = new Set(["room_clip_budget", "clips_disabled", "mark_not_found", "clip_limit", "invalid_path", "invalid_size", "not_member"]);

interface QueueItem {
  markId: string;
  roomId: string;
  userId: string;
  path: string; // arquivo gravado pelo OBS
  attempts: number;
}

export interface ClipQueueStatus {
  pending: number;
  uploaded: number;
  failed: number;
  lastError: string;
}

let status: ClipQueueStatus = { pending: 0, uploaded: 0, failed: 0, lastError: "" };
const listeners = new Set<() => void>();
const setStatus = (next: Partial<ClipQueueStatus>) => {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
};
export const getClipStatus = () => status;
export const useClipQueue = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
  );

// ---- fila persistida (só os metadados; o vídeo continua na pasta do OBS) ----------------------

function loadQueue(): QueueItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return [];
  }
}
function saveQueue(items: QueueItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* sem armazenamento: a fila vale só nesta sessão */
  }
}

let queue: QueueItem[] = loadQueue();
let running = false;
setStatus({ pending: queue.length });

// ---- miniatura e duração ----------------------------------------------------------------------

function once(target: HTMLVideoElement, event: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`vídeo: ${event} demorou demais`)), ms);
    target.addEventListener(
      event,
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

/** Tira um quadro do meio do clip (o final costuma mostrar o próprio app, onde o jogador marcou). */
async function inspectVideo(video: Blob): Promise<{ durationMs: number; thumb: Blob | null }> {
  const url = URL.createObjectURL(video);
  try {
    const el = document.createElement("video");
    el.muted = true;
    el.preload = "auto";
    el.src = url;
    await once(el, "loadedmetadata", 8000);
    const durationMs = Math.round((Number.isFinite(el.duration) ? el.duration : 0) * 1000);
    let thumb: Blob | null = null;
    try {
      el.currentTime = Math.max(0, el.duration * 0.6);
      await once(el, "seeked", 8000);
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = Math.round((320 * (el.videoHeight || 9)) / (el.videoWidth || 16));
      canvas.getContext("2d")?.drawImage(el, 0, 0, canvas.width, canvas.height);
      thumb = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.7));
    } catch {
      /* sem miniatura: o clip continua válido */
    }
    return { durationMs, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- envio ------------------------------------------------------------------------------------

async function upload(item: QueueItem): Promise<void> {
  const bytes = await invoke<ArrayBuffer>("read_clip", { path: item.path });
  const video = new Blob([bytes], { type: "video/mp4" });
  const base = `${item.roomId}/${item.userId}/${item.markId}`;
  const { durationMs, thumb } = await inspectVideo(video).catch(() => ({ durationMs: 0, thumb: null }));

  const up = await supabase.storage.from("clips").upload(`${base}.mp4`, video, { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error(up.error.message);

  let thumbPath: string | undefined;
  if (thumb) {
    const tu = await supabase.storage.from("clips").upload(`${base}.jpg`, thumb, { contentType: "image/jpeg", upsert: true });
    if (!tu.error) thumbPath = `${base}.jpg`;
  }
  try {
    await api.attachClip(supabase, {
      markId: item.markId,
      storagePath: `${base}.mp4`,
      bytes: video.size,
      durationMs,
      thumbPath,
    });
  } catch (e) {
    // Sem espaço na sala: não deixa o arquivo órfão no servidor; o original continua no computador do jogador.
    if (e instanceof BingueyError && e.code === "room_clip_budget") {
      await supabase.storage.from("clips").remove([`${base}.mp4`, ...(thumbPath ? [thumbPath] : [])]).catch(() => {});
    }
    throw e;
  }

  // Por padrão o arquivo fica no PC do jogador. Só some se ele pediu (e só na pasta dedicada do Binguey).
  if (getSettings().deleteLocalAfterUpload) await invoke("delete_clip", { path: item.path }).catch(() => {});
}

/** Processa a fila em série, com reenvio exponencial (2 s, 4 s, 8 s...). */
export async function processQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const item = queue[0]!;
      try {
        await upload(item);
        queue = queue.slice(1);
        setStatus({ uploaded: status.uploaded + 1, pending: queue.length });
      } catch (e) {
        const message = e instanceof BingueyError ? errorMessage(e) : e instanceof Error ? e.message : String(e);
        const fatal = e instanceof BingueyError && FATAL.has(e.code);
        item.attempts += 1;
        if (fatal || item.attempts >= MAX_ATTEMPTS) {
          queue = queue.slice(1);
          setStatus({ failed: status.failed + 1, pending: queue.length, lastError: message });
        } else {
          setStatus({ lastError: message });
          saveQueue(queue);
          await new Promise((r) => setTimeout(r, 2000 * 2 ** (item.attempts - 1)));
          continue;
        }
      }
      saveQueue(queue);
    }
  } finally {
    running = false;
  }
}

/**
 * Pedido de clip para uma marcação. Corre em paralelo com o `mark_cell`: se a marcação
 * perder ("alguém marcou primeiro"), o clip é descartado e nada é enviado.
 */
export async function captureClip(opts: { roomId: string; userId: string; mark: Promise<Mark | null> }): Promise<void> {
  const saving = new Promise<string>((resolve, reject) => setTimeout(() => obs.saveReplay().then(resolve, reject), POST_ROLL_MS));
  saving.catch(() => {});
  const [mark, file] = await Promise.allSettled([opts.mark, saving]);
  if (mark.status !== "fulfilled" || !mark.value) return;
  if (file.status !== "fulfilled") {
    setStatus({ failed: status.failed + 1, lastError: file.reason instanceof Error ? file.reason.message : String(file.reason) });
    return;
  }
  queue = [...queue, { markId: mark.value.id, roomId: opts.roomId, userId: opts.userId, path: file.value, attempts: 0 }];
  saveQueue(queue);
  setStatus({ pending: queue.length });
  void processQueue();
}

/** Reenvia o que ficou pendente de uma sessão anterior. */
export function resumeQueue() {
  if (queue.length > 0) void processQueue();
}
