import { Board } from "../components/Board";
import { Relogio } from "../components/Relogio";
import { useRoom } from "../hooks/useRoom";
import { isDesktop } from "../lib/desktop";
import { getActiveRoom } from "../lib/storage";

/**
 * Mini-tabuleiro: janela pequena, sempre no topo, aberta por Ctrl+Shift+B. Mostra a sala em que o jogador
 * está e manda a marcação para a janela principal, que é quem grava o clip.
 */
export function Overlay() {
  const code = getActiveRoom();
  return (
    <main className="overlay">
      {code ? <OverlayRoom code={code} /> : <p className="rotulo">Entre em uma sala no app para usar o mini-tabuleiro.</p>}
    </main>
  );
}

function OverlayRoom({ code }: { code: string }) {
  const { phase, data, offset } = useRoom(code);
  if (phase === "loading") return <p className="rotulo">carregando…</p>;
  if (phase !== "ready" || !data) return <p className="rotulo">Sala {code} não encontrada neste computador.</p>;

  const { room, cells, marks, nicknames } = data;
  return (
    <>
      <div className="overlay-topo">
        <span className="codigo">{room.code}</span>
        {room.status === "running" && room.ends_at ? (
          <Relogio endsAt={room.ends_at} offset={offset} onZero={() => {}} />
        ) : (
          <span className="rotulo">{room.status === "lobby" ? "aguardando início" : "partida encerrada"}</span>
        )}
      </div>
      {room.status === "running" ? (
        <Board
          size={room.size}
          cells={cells}
          marks={marks}
          nicknames={nicknames}
          canMark
          onMark={(idx) => void window.__TAURI__?.event.emit("binguey-mark", { idx })}
        />
      ) : (
        <p className="rotulo">O tabuleiro aparece aqui quando a partida começar.</p>
      )}
      {!isDesktop() && <p className="rotulo">Abra este mini-tabuleiro pelo app para marcar casas.</p>}
    </>
  );
}
