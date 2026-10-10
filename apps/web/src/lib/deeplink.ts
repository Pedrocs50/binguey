import { parseInvite } from "@binguey/shared";
import { invoke, isDesktop } from "./desktop";
import { navigate } from "./router";

function open(url: string) {
  // parseInvite aceita só 6 caracteres do alfabeto de salas; qualquer outra coisa é ignorada.
  const code = parseInvite(url);
  void invoke("dev_report", { line: `deeplink: ${url} -> ${code ?? "inválido"}` }).catch(() => {});
  if (code) navigate(`/j/${code}`);
}

/** Convites binguey://j/CODIGO abrem o app direto na tela de entrada da sala. */
export async function setupDeepLinks(): Promise<void> {
  if (!isDesktop()) return;
  await window.__TAURI__!.event.listen<string>("binguey-deeplink", (e) => {
    open(e.payload);
    void invoke("take_pending_link").catch(() => {});
  });
  const pending = await invoke<string | null>("take_pending_link").catch(() => null);
  if (pending) open(pending);
}
