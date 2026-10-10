import { useEffect, useState } from "react";
import { isDesktop } from "../lib/desktop";
import {
  chooseClips,
  findFfmpeg,
  installFfmpeg,
  renderHighlights,
  revealRender,
  type RenderResult,
  type VideoSource,
} from "../lib/video";

type Phase = "checking" | "missing" | "installing" | "ready" | "rendering" | "done" | "error";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Vídeo final da partida. Só no app: o ffmpeg e o Explorer são do computador do jogador. */
export function HighlightsPanel({ source }: { source: VideoSource }) {
  const desktop = isDesktop();
  const [phase, setPhase] = useState<Phase>("checking");
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState("");
  const picked = chooseClips(source).length;

  useEffect(() => {
    if (desktop) void findFfmpeg().then((p) => setPhase(p ? "ready" : "missing"));
  }, [desktop]);

  if (source.clips.length === 0) return null;
  if (!desktop) {
    return (
      <section className="secao">
        <h2>vídeo final</h2>
        <p className="rotulo">Para montar o vídeo com os melhores momentos, use o app Binguey no computador.</p>
      </section>
    );
  }

  async function install() {
    if (!window.confirm("Para montar o vídeo preciso do ffmpeg. Instalar agora pelo winget (pacote Gyan.FFmpeg, uns 100 MB)?")) return;
    setPhase("installing");
    setError("");
    try {
      await installFfmpeg();
      setPhase("ready");
    } catch (e) {
      setError(typeof e === "string" ? e : e instanceof Error ? e.message : "A instalação falhou.");
      setPhase("missing");
    }
  }

  async function build() {
    setPhase("rendering");
    setPct(0);
    setError("");
    try {
      setResult(await renderHighlights(source, setPct));
      setPhase("done");
    } catch (e) {
      const text = typeof e === "string" ? e : e instanceof Error ? e.message : "Não foi possível montar o vídeo.";
      if (text === "ffmpeg_ausente") setPhase("missing");
      else {
        setError(text);
        setPhase("error");
      }
    }
  }

  return (
    <section className="secao">
      <h2>vídeo final</h2>
      <p className="rotulo" style={{ marginTop: 0 }}>
        {picked} {picked === 1 ? "clip" : "clips"} no vídeo, com os das linhas vencedoras primeiro. Ele é montado aqui, no seu
        computador, e salvo em Vídeos\Binguey.
      </p>
      {error && <div className="aviso erro">{error}</div>}

      {phase === "missing" && (
        <>
          <p className="mono">O ffmpeg não está instalado neste computador.</p>
          <button className="botao" type="button" onClick={() => void install()}>
            instalar o ffmpeg
          </button>
        </>
      )}
      {phase === "installing" && <p className="mono">Instalando o ffmpeg… isso pode levar alguns minutos.</p>}
      {(phase === "ready" || phase === "error") && (
        <button className="botao" type="button" onClick={() => void build()}>
          montar vídeo final
        </button>
      )}
      {phase === "rendering" && (
        <p className="mono" role="status">
          Montando o vídeo… {pct}%
        </p>
      )}
      {phase === "done" && result && (
        <>
          <p className="mono">
            Pronto: vídeo de {fmt(result.duration_s)} · {(result.bytes / 1024 / 1024).toFixed(1)} MB · montado em{" "}
            {result.seconds.toFixed(0)} s ({result.encoder})
          </p>
          {result.black_ratio > 0.8 && (
            <div className="aviso erro">
              O vídeo saiu quase todo preto: a captura do OBS não estava pegando imagem. Confira a fonte de captura (ou o modo
              “o que gravar”) e grave de novo.
            </div>
          )}
          {result.max_volume_db !== null && result.max_volume_db < -60 && (
            <div className="aviso erro">
              O vídeo saiu sem som. No OBS, confira se o som do desktop está sendo capturado (no painel de clips o app cria a fonte
              de áudio sozinho; reconecte o OBS e grave de novo).
            </div>
          )}
          <div className="acoes">
            <button className="botao" type="button" onClick={() => void revealRender()}>
              mostrar no Explorer
            </button>
            <button className="botao sec" type="button" onClick={() => void build()}>
              montar de novo
            </button>
          </div>
        </>
      )}
    </section>
  );
}
