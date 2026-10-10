export type BoardSize = 3 | 4 | 5;

export const BOARD_SIZES: readonly BoardSize[] = [3, 4, 5];

/** Número de linhas possíveis: n linhas + n colunas + 2 diagonais. */
export function maxLines(size: BoardSize): number {
  return 2 * size + 2;
}

/** Índices (0..size²-1, linha a linha) de cada linha, coluna e diagonal. */
export function lineIndices(size: BoardSize): number[][] {
  const lines: number[][] = [];
  const range = Array.from({ length: size }, (_, i) => i);
  for (const i of range) lines.push(range.map((j) => i * size + j)); // linhas
  for (const j of range) lines.push(range.map((i) => i * size + j)); // colunas
  lines.push(range.map((i) => i * size + i)); // diagonal principal
  lines.push(range.map((i) => i * size + (size - 1 - i))); // diagonal secundária
  return lines;
}

export function completedLines(size: BoardSize, marked: Iterable<number>): number[][] {
  const set = new Set(marked);
  return lineIndices(size).filter((line) => line.every((idx) => set.has(idx)));
}

export function isWin(size: BoardSize, marked: Iterable<number>, targetLines: number): boolean {
  return completedLines(size, marked).length >= targetLines;
}
