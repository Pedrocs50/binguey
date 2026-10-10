import { completedLines, type BoardSize } from "./board";

export interface HighlightMark {
  id: string;
  cell_idx: number;
  user_id: string;
  marked_at: string;
}

export interface HighlightClip {
  id: string;
  mark_id: string | null;
  user_id: string;
}

export interface HighlightInput {
  size: BoardSize;
  marks: HighlightMark[];
  clips: HighlightClip[];
  /** Máximo de clips no vídeo (padrão 10: cerca de 1 a 3 minutos). */
  max?: number;
}

/**
 * Escolhe os clips do vídeo final: primeiro os das linhas completas (o que decidiu a partida), depois
 * extras alternando entre os jogadores para todo mundo aparecer. O resultado sai em ordem cronológica.
 */
export function pickHighlights({ size, marks, clips, max = 10 }: HighlightInput): string[] {
  const markById = new Map(marks.map((m) => [m.id, m]));
  const withMark = clips
    .map((clip) => ({ clip, mark: clip.mark_id ? markById.get(clip.mark_id) : undefined }))
    .filter((x): x is { clip: HighlightClip; mark: HighlightMark } => !!x.mark)
    .sort((a, b) => a.mark.marked_at.localeCompare(b.mark.marked_at));

  const winningCells = new Set(completedLines(size, marks.map((m) => m.cell_idx)).flat());
  const core = withMark.filter((x) => winningCells.has(x.mark.cell_idx)).slice(0, max);

  const taken = new Set(core.map((x) => x.clip.id));
  const byUser = new Map<string, typeof withMark>();
  for (const x of withMark) {
    if (taken.has(x.clip.id)) continue;
    byUser.set(x.clip.user_id, [...(byUser.get(x.clip.user_id) ?? []), x]);
  }

  const extras: typeof withMark = [];
  const queues = [...byUser.values()];
  while (core.length + extras.length < max && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift(); // o mais antigo de cada jogador, em rodízio
      if (next && core.length + extras.length < max) extras.push(next);
    }
  }

  return [...core, ...extras]
    .sort((a, b) => a.mark.marked_at.localeCompare(b.mark.marked_at))
    .map((x) => x.clip.id);
}
