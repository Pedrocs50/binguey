import { useEffect, useState, type FormEvent } from "react";
import type { ClipPolicy } from "@binguey/shared";
import { useClipQueue } from "../lib/clips";
import { isDesktop } from "../lib/desktop";
import { autoConnectObs, connectObs, disconnectObs, useObsState } from "../lib/obsStore";
import { getObsPassword } from "../lib/storage";

const RELEASES_URL = "https://github.com/Pedrocs50/binguey/releases/latest";

/** Assistente de clips. No navegador só convida a instalar o app; no app guia o OBS. */
export function ObsPanel({ roomId, policy, compact }: { roomId: string; policy: ClipPolicy; compact?: boolean }) {
  if (policy === "off") return null;
  if (!isDesktop()) return compact ? null : <InstallHint />;
  return <Wizard roomId={roomId} compact={!!compact} />;
}

function InstallHint() {
  return (
    <section className="secao">
      <h2>clips automáticos</h2>
      <p className="mono">
        Quer um clip a cada casa marcada? Instale o app de desktop (Windows) e use o OBS.{" "}
        <a href={RELEASES_URL} rel="noopener" target="_blank">
          baixar o app ↗
        </a>
      </p>
      <p className="rotulo">Sem o app o bingo funciona normalmente, só não grava clips.</p>
    </section>
  );
}

function Wizard({ roomId, compact }: { roomId: string; compact: boolean }) {
  const obs = useObsState();
  const queue = useClipQueue();
  const [password, setPassword] = useState(getObsPassword);
  const [open, setOpen] = useState(false);

  // Se já há uma senha guardada, reconecta sozinho ao entrar na sala.
  useEffect(() => autoConnectObs(roomId), [roomId]);

  function submit(e: FormEvent) {
    e.preventDefault();
    void connectObs(password, { test: true, roomId });
  }

  const busy = obs.phase === "connecting";
  const ready = obs.phase === "ready";

  const form = (
    <form onSubmit={submit}>
      {!ready && (
        <label className="campo">
          <span className="rotulo">senha do WebSocket do OBS</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            placeholder="OBS → Ferramentas → Configurações do servidor WebSocket"
          />
          <span className="rotulo dica">fica só neste computador, nunca vai para o servidor</span>
        </label>
      )}
      <div className="acoes">
        {ready ? (
          <>
            <button className="botao sec" type="submit" disabled={busy}>
              gravar clip de teste
            </button>
            <button className="botao sec" type="button" onClick={() => disconnectObs(roomId)}>
              desativar clips
            </button>
          </>
        ) : (
          <button className="botao" type="submit" disabled={busy || password.length === 0}>
            {busy ? "conectando…" : "conectar e testar"}
          </button>
        )}
      </div>
    </form>
  );

  const status = (
    <>
      {ready && (
        <p className="mono" style={{ margin: "0 0 0.8rem" }}>
          [clips ativos] OBS {obs.version}
          {obs.testMb !== null && ` · clip de teste ok (${obs.testMb.toFixed(1)} MB)`}
        </p>
      )}
      {obs.phase === "error" && (
        <div className="aviso erro" role="alert">
          {obs.message}
        </div>
      )}
      {(queue.pending > 0 || queue.uploaded > 0 || queue.failed > 0) && (
        <p className="rotulo">
          clips: {queue.uploaded} enviados
          {queue.pending > 0 && ` · ${queue.pending} na fila`}
          {queue.failed > 0 && ` · ${queue.failed} falharam`}
          {queue.lastError && queue.failed > 0 && ` (${queue.lastError})`}
        </p>
      )}
    </>
  );

  if (compact) {
    return (
      <details className="secao-compacta" open={open || !ready} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="mono">{ready ? "[clips ativos]" : "clips desligados — conectar ao OBS"}</summary>
        {status}
        {form}
      </details>
    );
  }
  return (
    <section className="secao">
      <h2>clips automáticos</h2>
      {status}
      {form}
      {!ready && (
        <p className="rotulo" style={{ marginTop: "1rem" }}>
          Antes: no OBS, ative o servidor WebSocket (Ferramentas → Configurações do servidor WebSocket) e o Buffer de
          Repetição (Configurações → Saída, 20 s). Use “Captura de Jogo”; se o jogo ficar preto, rode em janela sem
          bordas.
        </p>
      )}
    </section>
  );
}
