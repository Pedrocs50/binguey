import { pickHighlights, type Cell, type Clip, type Mark, type Room } from "@binguey/shared";
import { invoke } from "./desktop";
import { supabase } from "./supabase";

export interface RenderResult {
  path: string;
  seconds: number;
  bytes: number;
  encoder: string;
  duration_s: number;
  black_ratio: number;
}

export interface VideoSource {
  room: Pick<Room, "code" | "size">;
  cells: Cell[];
  marks: Mark[];
  clips: Clip[];
  nicknames: Record<string, string>;
}

export const findFfmpeg = () => invoke<string | null>("find_ffmpeg").catch(() => null);
export const installFfmpeg = () => invoke<string>("install_ffmpeg");
export const revealRender = () => invoke<void>("reveal_render").catch(() => {});

/** Clips que entram no vídeo: os das linhas vencedoras primeiro, depois extras de todos os jogadores. */
export function chooseClips(src: VideoSource, max = 10): Clip[] {
  const ids = new Set(pickHighlights({ size: src.room.size, marks: src.marks, clips: src.clips, max }));
  const markTime = new Map(src.marks.map((m) => [m.id, m.marked_at]));
  return src.clips
    .filter((c) => ids.has(c.id))
    .sort((a, b) => (markTime.get(a.mark_id) ?? "").localeCompare(markTime.get(b.mark_id) ?? ""));
}

/** Monta o vídeo final no computador de quem pediu: baixa só os clips escolhidos (URLs assinadas) via ffmpeg. */
export async function renderHighlights(src: VideoSource, onProgress: (pct: number) => void, max = 10): Promise<RenderResult> {
  const chosen = chooseClips(src, max);
  if (chosen.length === 0) throw new Error("Nenhum clip para montar o vídeo.");

  const signed = await supabase.storage.from("clips").createSignedUrls(
    chosen.map((c) => c.storage_path),
    3600,
  );
  if (signed.error || !signed.data) throw new Error("Não consegui acessar os clips da sala.");
  const urlOf = new Map(signed.data.map((s) => [s.path, s.signedUrl]));

  const segments = chosen.map((clip, i) => {
    const mark = src.marks.find((m) => m.id === clip.mark_id);
    const goal = src.cells.find((c) => c.idx === mark?.cell_idx)?.goal_text ?? "";
    return {
      url: urlOf.get(clip.storage_path) ?? "",
      line1: goal,
      line2: `por ${src.nicknames[clip.user_id] ?? "?"}   ${i + 1}/${chosen.length}`,
      duration_ms: clip.duration_ms ?? 20000,
    };
  });

  let stop: (() => void) | undefined;
  try {
    stop = await window.__TAURI__?.event.listen<number>("binguey-render-progress", (e) => onProgress(e.payload));
    return await invoke<RenderResult>("render_highlights", { plan: { segments, title: `sala ${src.room.code}` } });
  } finally {
    stop?.();
  }
}
