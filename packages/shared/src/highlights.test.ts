import { describe, expect, it } from "vitest";
import { pickHighlights, type HighlightClip, type HighlightMark } from "./highlights";

let n = 0;
const mark = (cell_idx: number, user_id: string, sec: number): HighlightMark => ({
  id: `m${++n}`,
  cell_idx,
  user_id,
  marked_at: new Date(2026, 9, 10, 20, 0, sec).toISOString(),
});
const clipOf = (m: HighlightMark): HighlightClip => ({ id: `c-${m.id}`, mark_id: m.id, user_id: m.user_id });

describe("pickHighlights", () => {
  it("põe primeiro os clips da linha completa, em ordem cronológica", () => {
    // 3x3: linha de cima (0,1,2) completa; casa 8 isolada
    const a = mark(0, "ana", 10);
    const b = mark(1, "bia", 20);
    const c = mark(2, "ana", 30);
    const solo = mark(8, "bia", 5);
    const marks = [a, b, c, solo];
    const ids = pickHighlights({ size: 3, marks, clips: marks.map(clipOf), max: 3 });
    expect(ids).toEqual([clipOf(a).id, clipOf(b).id, clipOf(c).id]);
  });

  it("completa com extras alternando entre jogadores", () => {
    const line = [mark(0, "ana", 1), mark(1, "ana", 2), mark(2, "ana", 3)];
    const extraAna = [mark(4, "ana", 10), mark(5, "ana", 11)];
    const extraBia = [mark(6, "bia", 20), mark(7, "bia", 21)];
    const marks = [...line, ...extraAna, ...extraBia];
    const ids = pickHighlights({ size: 3, marks, clips: marks.map(clipOf), max: 5 });
    expect(ids).toHaveLength(5);
    // 3 da linha + 1 extra da Ana + 1 extra da Bia (rodízio), não 2 da Ana
    expect(ids).toContain(clipOf(extraAna[0]!).id);
    expect(ids).toContain(clipOf(extraBia[0]!).id);
    expect(ids).not.toContain(clipOf(extraAna[1]!).id);
  });

  it("respeita o máximo e ignora clips sem marcação", () => {
    const marks = Array.from({ length: 9 }, (_, i) => mark(i, i % 2 ? "ana" : "bia", i));
    const clips = [...marks.map(clipOf), { id: "orfao", mark_id: "nao-existe", user_id: "ana" }, { id: "sem", mark_id: null, user_id: "ana" }];
    const ids = pickHighlights({ size: 3, marks, clips, max: 4 });
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain("orfao");
    expect(ids).not.toContain("sem");
  });

  it("sem clips, devolve vazio", () => {
    expect(pickHighlights({ size: 4, marks: [mark(0, "ana", 1)], clips: [] })).toEqual([]);
  });
});
