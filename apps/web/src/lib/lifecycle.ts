import { isDesktop } from "./desktop";
import { disconnectObs, getObsState } from "./obsStore";

/** Ao fechar o app, devolve o perfil do OBS do jogador (com limite de tempo, para nunca travar o fechamento). */
export async function setupLifecycle(): Promise<void> {
  if (!isDesktop()) return;
  const win = window.__TAURI__?.window?.getCurrentWindow();
  if (!win) return;
  await win.onCloseRequested(async () => {
    if (getObsState().phase !== "ready") return;
    await Promise.race([disconnectObs(), new Promise((r) => setTimeout(r, 4000))]);
  });
}
