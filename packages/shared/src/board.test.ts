import { describe, expect, it } from "vitest";
import { BOARD_SIZES, completedLines, isFull, isWin, lineIndices, maxLines } from "./board";

describe("board", () => {
  it("tem 8, 10 e 12 linhas para 3x3, 4x4 e 5x5", () => {
    expect(BOARD_SIZES.map((s) => lineIndices(s).length)).toEqual([8, 10, 12]);
    expect(BOARD_SIZES.map(maxLines)).toEqual([8, 10, 12]);
  });

  it("toda linha tem exatamente `size` casas distintas", () => {
    for (const s of BOARD_SIZES) {
      for (const line of lineIndices(s)) expect(new Set(line).size).toBe(s);
    }
  });

  it("detecta linha, coluna e diagonais", () => {
    expect(completedLines(3, [0, 1, 2])).toHaveLength(1);
    expect(completedLines(3, [0, 3, 6])).toHaveLength(1);
    expect(completedLines(3, [0, 4, 8])).toHaveLength(1);
    expect(completedLines(3, [2, 4, 6])).toHaveLength(1);
  });

  it("não conta linhas incompletas", () => {
    expect(completedLines(4, [0, 1, 2])).toHaveLength(0);
  });

  it("vence ao atingir as linhas-alvo", () => {
    const marked = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // 3x3 cheio = 8 linhas
    expect(isWin(3, marked, 8)).toBe(true);
    expect(isWin(3, [0, 1, 2], 2)).toBe(false);
    expect(isWin(3, [0, 1, 2, 3, 4, 5], 2)).toBe(true);
  });

  it("cartela cheia só com todas as casas marcadas", () => {
    expect(isFull(3, [0, 1, 2, 3, 4, 5, 6, 7])).toBe(false);
    expect(isFull(3, [0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);
    expect(isFull(3, [0, 0, 1, 2, 3, 4, 5, 6, 7])).toBe(false); // repetidas não contam
    expect(isFull(4, Array.from({ length: 16 }, (_, i) => i))).toBe(true);
  });
});
