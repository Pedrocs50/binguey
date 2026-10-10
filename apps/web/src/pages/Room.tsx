import { useEffect, useMemo, useState } from "react";
import { api, completedLines, inviteUrl } from "@binguey/shared";
import { Board } from "../components/Board";
import { ClipGallery } from "../components/ClipGallery";
import { Link } from "../components/Link";
import { ObsPanel } from "../components/ObsPanel";
import { Relogio } from "../components/Relogio";
import { useRoom, type RoomData } from "../hooks/useRoom";
import { captureClip, resumeQueue } from "../lib/clips";
import { isDesktop } from "../lib/desktop";
import { getObsState } from "../lib/obsStore";
import { errorMessage } from "../lib/errors";
import { navigate } from "../lib/router";
import { rememberRoom } from "../lib/storage";
import { supabase } from "../lib/supabase";

export function RoomPage({ code }: { code: string }) {
  const { phase, data, me, offset, notice, setNotice, markCell, closeTimeout, reload } = useRoom(code);

  useEffect(() => {
    if (phase === "ready") rememberRoom(code);
  }, [phase, code]);

  useEffect(() => {
    if (isDesktop()) resumeQueue(); // reenvia clips que ficaram pendentes de uma sessão anterior
  }, []);

  if (phase === "loading") return <p className="rotulo">carregando sala…</p>;
  if (phase === "error")
    return (
      <>
        <div className="aviso erro">Não foi possível carregar a sala. Verifique a conexão.</div>
        <button className="botao sec" onClick={() => void reload()}>
          tentar de novo
        </button>
      </>
    );
  if (phase === "notfound" || !data || !me)
    return (
      <>
        <div className="aviso">Sala não encontrada, ou você ainda não entrou nela.</div>
        <Link href={`/j/${code}`}>entrar na sala {code}</Link>
      </>
    );

  const { room } = data;

  // A marcação e o clip correm em paralelo: o clip só segue se a marcação valer.
  function handleMark(idx: number) {
    const mark = markCell(idx);
    if (isDesktop() && room.clip_policy !== "off" && getObsState().phase === "ready") {
      void captureClip({ roomId: room.id, userId: me!, mark });
    }
  }

  return (
    <>
      <div className="sala-topo">
        <h1>
          sala <span className="codigo">{room.code}</span>
        </h1>
        {room.status === "running" && room.ends_at && (
          <Relogio endsAt={room.ends_at} offset={offset} onZero={() => void closeTimeout()} />
        )}
      </div>

      {notice && (
        <div className="aviso erro" role="alert" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}

      {room.status === "lobby" && <Lobby data={data} me={me} />}
      {room.status === "running" && (
        <Play
          data={data}
          me={me}
          onMark={handleMark}
          onEnd={async () => {
            if (!window.confirm("Encerrar a partida agora para todos?")) return;
            try {
              await api.endRoom(supabase, room.id);
            } catch (e) {
              setNotice(errorMessage(e));
            }
          }}
        />
      )}
      {(room.status === "finished" || room.status === "expired") && <Finished data={data} me={me} />}
    </>
  );
}

function Resumo({ data }: { data: RoomData }) {
  const { room } = data;
  const clip = { off: "desligados", optional: "opcionais", required: "obrigatórios" }[room.clip_policy];
  return (
    <p className="rotulo">
      {room.size}×{room.size} · {Math.round(room.duration_s / 60)} min · {room.target_lines}{" "}
      {room.target_lines === 1 ? "linha" : "linhas"} para vencer · clips {clip}
    </p>
  );
}

function Lobby({ data, me }: { data: RoomData; me: string }) {
  const { room, members, nicknames } = data;
  const isHost = room.host_id === me;
  const link = inviteUrl(window.location.origin, room.code);
  const [copied, setCopied] = useState(false);
  const [games, setGames] = useState<{ slug: string; name: string }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [gameQuery, setGameQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHost) return;
    void supabase
      .from("games")
      .select("slug, name")
      .order("name")
      .then((r) => setGames((r.data ?? []) as { slug: string; name: string }[]));
  }, [isHost]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", link);
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    const goals = custom.split("\n").map((l) => l.trim()).filter(Boolean);
    try {
      await api.startRoom(supabase, room.id, goals, picked.length ? picked : null);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const needed = room.size * room.size;

  return (
    <>
      <Resumo data={data} />

      <section className="secao">
        <h2>convite</h2>
        <p className="mono" style={{ overflowWrap: "anywhere" }}>
          {link}
        </p>
        <button className="botao sec" type="button" onClick={() => void copy()}>
          {copied ? "copiado ✓" : "copiar link"}
        </button>
      </section>

      <ObsPanel roomId={room.id} policy={room.clip_policy} />

      <section className="secao">
        <h2>na sala ({members.length})</h2>
        <ul className="lista">
          {members.map((m) => (
            <li key={m.user_id}>
              <span>
                {nicknames[m.user_id] ?? "…"}
                {m.user_id === room.host_id && <span className="rotulo"> · anfitrião</span>}
                {m.user_id === me && <span className="rotulo"> · você</span>}
              </span>
              <span className="rotulo">{m.clips_active ? "[clips ativos]" : ""}</span>
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <section className="secao">
          <h2>objetivos</h2>
          <p className="rotulo" style={{ marginTop: 0 }}>
            Por padrão o tabuleiro usa só objetivos que servem para qualquer jogo: cada um cumpre no jogo que quiser, e pode
            abrir e fechar jogos durante a partida.
          </p>
          {error && (
            <div className="aviso erro" role="alert">
              {error}
            </div>
          )}
          {games.length > 0 && (
            <div className="campo">
              <span className="rotulo">
                objetivos extras de jogos específicos (opcional){picked.length > 0 ? ` · ${picked.length} escolhidos` : ""}
              </span>
              <input
                type="search"
                value={gameQuery}
                onChange={(e) => setGameQuery(e.target.value)}
                placeholder={`buscar entre ${games.length} jogos…`}
                aria-label="Buscar jogo"
              />
              <div className="lista-jogos">
                {games
                  .filter((g) => picked.includes(g.slug) || g.name.toLowerCase().includes(gameQuery.trim().toLowerCase()))
                  .map((g) => (
                    <label key={g.slug} className="mono">
                      <input
                        type="checkbox"
                        checked={picked.includes(g.slug)}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, g.slug] : p.filter((s) => s !== g.slug)))}
                      />{" "}
                      {g.name}
                    </label>
                  ))}
              </div>
            </div>
          )}
          <label className="campo">
            <span className="rotulo">objetivos próprios (um por linha, opcional)</span>
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={"Morrer para o primeiro inimigo\nTirar print de uma paisagem"}
            />
            <span className="rotulo dica">o tabuleiro precisa de {needed} objetivos; completamos com a biblioteca.</span>
          </label>
          <button className="botao" type="button" disabled={busy} onClick={() => void start()}>
            {busy ? "iniciando…" : "iniciar partida"}
          </button>
        </section>
      ) : (
        <p className="rotulo secao">aguardando o anfitrião iniciar a partida…</p>
      )}
    </>
  );
}

function Play({
  data,
  me,
  onMark,
  onEnd,
}: {
  data: RoomData;
  me: string;
  onMark: (idx: number) => void;
  onEnd: () => void;
}) {
  const { room, cells, marks, nicknames, clips } = data;
  const lines = completedLines(room.size, marks.map((m) => m.cell_idx)).length;
  return (
    <>
      <p className="progresso mono">
        linhas: {lines}/{room.target_lines} · casas marcadas: {marks.length}/{cells.length}
      </p>
      <Board size={room.size} cells={cells} marks={marks} nicknames={nicknames} canMark onMark={onMark} />
      <ObsPanel roomId={room.id} policy={room.clip_policy} compact />
      <ClipGallery clips={clips} cells={cells} marks={marks} nicknames={nicknames} me={me} />
      {room.host_id === me && (
        <p className="secao">
          <button className="botao sec" type="button" onClick={onEnd}>
            encerrar partida
          </button>
        </p>
      )}
    </>
  );
}

function Finished({ data, me }: { data: RoomData; me: string }) {
  const { room, cells, marks, nicknames, clips } = data;
  const lines = completedLines(room.size, marks.map((m) => m.cell_idx)).length;
  const ranking = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of marks) count.set(m.user_id, (count.get(m.user_id) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [marks]);

  return (
    <>
      <div className="resultado">
        {room.status === "expired" ? (
          <h2>sala expirada</h2>
        ) : room.result === "won" ? (
          <h2>vitória! 🎉</h2>
        ) : room.result === "ended" ? (
          <h2>partida encerrada pelo anfitrião</h2>
        ) : (
          <h2>tempo esgotado</h2>
        )}
        <p className="mono" style={{ margin: 0 }}>
          {lines}/{room.target_lines} {room.target_lines === 1 ? "linha" : "linhas"} · {marks.length}/{cells.length} casas
        </p>
      </div>

      <Board size={room.size} cells={cells} marks={marks} nicknames={nicknames} canMark={false} onMark={() => {}} />

      <ClipGallery clips={clips} cells={cells} marks={marks} nicknames={nicknames} me={me} />

      <section className="secao">
        <h2>quem marcou</h2>
        <ul className="lista">
          {ranking.map(([id, n]) => (
            <li key={id}>
              <span>{nicknames[id] ?? "?"}</span>
              <span className="rotulo">{n}</span>
            </li>
          ))}
          {ranking.length === 0 && (
            <li>
              <span className="rotulo">ninguém marcou nada</span>
            </li>
          )}
        </ul>
      </section>

      <p className="secao">
        <button className="botao" type="button" onClick={() => navigate("/")}>
          nova sala
        </button>
      </p>
    </>
  );
}
