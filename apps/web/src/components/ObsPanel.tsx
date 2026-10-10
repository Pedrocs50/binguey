import { useEffect, useState, type FormEvent } from "react";
import type { ClipPolicy } from "@binguey/shared";
import { useClipQueue } from "../lib/clips";
import { isDesktop } from "../lib/desktop";
import {
  autoConnectObs,
  cleanLocalClips,
  connectObs,
  disconnectObs,
  localClipsInfo,
  openClipsDir,
  readObsConfig,
  useObsState,
  type LocalClips,
} from "../lib/obsStore";
import { getObsPassword, getSettings, setSettings, type CaptureMode } from "../lib/storage";

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

/** Arquivos locais dos replays: por padrão ficam guardados; apagar é opção do jogador. */
const MODES: { id: CaptureMode; label: string; hint: string }[] = [
  { id: "display", label: "qualquer jogo", hint: "grava o monitor principal; serve para qualquer jogo, em janela ou tela cheia" },
  { id: "game", label: "só o jogo em tela cheia", hint: "Captura de Jogo; não grava notificações, mas não pega jogo em janela comum" },
  { id: "mine", label: "a minha cena do OBS", hint: "não mexo na sua cena; você configura as fontes" },
];

/** O que o OBS grava. Ao trocar, reaplica a configuração na hora. */
function CaptureChoice({ roomId, password }: { roomId: string; password: string }) {
  const [mode, setMode] = useState<CaptureMode>(() => getSettings().captureMode);
  function choose(next: CaptureMode) {
    setMode(next);
    setSettings({ ...getSettings(), captureMode: next });
    void connectObs(getObsPassword() || password, { roomId });
  }
  return (
    <fieldset className="modos">
      <legend className="rotulo">o que gravar (você pode abrir e fechar jogos à vontade)</legend>
      {MODES.map((m) => (
        <label key={m.id} className="mono">
          <input type="radio" name="captura" checked={mode === m.id} onChange={() => choose(m.id)} /> {m.label}
          <span className="rotulo dica"> — {m.hint}</span>
        </label>
      ))}
    </fieldset>
  );
}

function LocalFiles() {
  const queue = useClipQueue();
  const [info, setInfo] = useState<LocalClips | null>(null);
  const [del, setDel] = useState(() => getSettings().deleteLocalAfterUpload);
  const [error, setError] = useState("");

  useEffect(() => {
    void localClipsInfo().then(setInfo);
  }, [queue.uploaded, queue.pending]);

  async function clean() {
    if (!info || !window.confirm(`Apagar ${info.count} clips guardados neste computador? Os já enviados à sala continuam lá.`)) return;
    setError("");
    try {
      await cleanLocalClips();
      setInfo(await localClipsInfo());
    } catch (e) {
      setError(e instanceof Error && e.message === "pasta_nao_dedicada" ? "Só limpo a pasta própria do Binguey." : "Não consegui apagar.");
    }
  }

  return (
    <div className="arquivos">
      <p className="rotulo" style={{ margin: "0 0 0.4rem" }}>
        arquivos neste computador: {info ? `${info.count} clips · ${(info.bytes / 1024 / 1024).toFixed(0)} MB` : "…"}
      </p>
      <label className="mono" style={{ display: "block", marginBottom: "0.6rem" }}>
        <input
          type="checkbox"
          checked={del}
          onChange={(e) => {
            setDel(e.target.checked);
            setSettings({ ...getSettings(), deleteLocalAfterUpload: e.target.checked });
          }}
        />{" "}
        apagar o arquivo daqui depois de enviar à sala
      </label>
      <div className="acoes">
        <button className="botao sec" type="button" onClick={() => void openClipsDir()}>
          abrir pasta
        </button>
        <button className="botao sec" type="button" disabled={!info || info.count === 0} onClick={() => void clean()}>
          limpar agora
        </button>
      </div>
      {error && <p className="rotulo">{error}</p>}
    </div>
  );
}

function Wizard({ roomId, compact }: { roomId: string; compact: boolean }) {
  const obs = useObsState();
  const queue = useClipQueue();
  const [password, setPassword] = useState(getObsPassword);
  const [open, setOpen] = useState(false);

  // Reconecta sozinho ao entrar na sala (senha guardada ou lida da configuração do OBS).
  useEffect(() => {
    void autoConnectObs(roomId);
    if (!getObsPassword()) void readObsConfig().then((c) => c?.password && setPassword((p) => p || c.password));
  }, [roomId]);

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
      {ready && obs.captureWarning && <div className="aviso">{obs.captureWarning}</div>}
      {ready && obs.profileNote && <div className="aviso">{obs.profileNote}</div>}
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
        {ready && <CaptureChoice roomId={roomId} password={password} />}
        {ready && <LocalFiles />}
      </details>
    );
  }
  return (
    <section className="secao">
      <h2>clips automáticos</h2>
      {status}
      {form}
      {ready && <CaptureChoice roomId={roomId} password={password} />}
        {ready && <LocalFiles />}
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
