import { completedLines, type BoardSize, type Cell, type Mark } from "@binguey/shared";

interface Props {
  size: BoardSize;
  cells: Cell[];
  marks: Mark[];
  nicknames: Record<string, string>;
  canMark: boolean;
  onMark: (idx: number) => void;
}

export function Board({ size, cells, marks, nicknames, canMark, onMark }: Props) {
  const byIdx = new Map(marks.map((m) => [m.cell_idx, m]));
  const inLine = new Set(completedLines(size, byIdx.keys()).flat());

  return (
    <div className="tabuleiro" data-size={size} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {cells.map((c) => {
        const mark = byIdx.get(c.idx);
        const who = mark ? (nicknames[mark.user_id] ?? "?") : null;
        const cls = ["casa", mark && "marcada", inLine.has(c.idx) && "em-linha", mark?.id.startsWith("tmp-") && "pendente"]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={c.idx}
            type="button"
            className={cls}
            disabled={!canMark || !!mark}
            aria-pressed={!!mark}
            aria-label={who ? `${c.goal_text}, marcada por ${who}` : c.goal_text}
            onClick={() => onMark(c.idx)}
          >
            <span>{c.goal_text}</span>
            {who ? (
              <span className="quem">✓ {who}</span>
            ) : (
              <span className="tags">
                {c.game_slug && <span>#{c.game_slug}</span>}
                {c.kind && c.kind !== "misc" && <span>#{c.kind}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
