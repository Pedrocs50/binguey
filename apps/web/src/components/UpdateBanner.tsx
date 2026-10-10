import { useEffect, useState } from "react";
import { invoke, isDesktop } from "../lib/desktop";
import { disconnectObs, getObsState } from "../lib/obsStore";

interface UpdateInfo {
  version: string;
  notes: string | null;
}

/** Avisa quando há versão nova do app (Releases do GitHub). Só atualiza se o jogador clicar. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isDesktop() || window.location.pathname.startsWith("/overlay")) return;
    // Espera o app assentar; falha de rede ou ausência de Releases é silenciosa.
    const t = setTimeout(() => void invoke<UpdateInfo | null>("check_update").then(setUpdate).catch(() => {}), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!update) return null;

  async function install() {
    setBusy(true);
    setError("");
    try {
      if (getObsState().phase === "ready") await disconnectObs(); // devolve o perfil do OBS antes de reiniciar
      await invoke("install_update");
    } catch (e) {
      setError(typeof e === "string" ? e : "Não foi possível atualizar agora.");
      setBusy(false);
    }
  }

  return (
    <div className="aviso" role="status" style={{ margin: "0 0 1rem" }}>
      Nova versão do Binguey: <strong>{update.version}</strong>.{" "}
      <button type="button" className="link" disabled={busy} onClick={() => void install()}>
        {busy ? "atualizando…" : "atualizar agora"}
      </button>
      {error && <div className="rotulo">{error}</div>}
    </div>
  );
}
