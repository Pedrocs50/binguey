// Ponte com o shell Tauri. No navegador comum isso tudo fica desligado (o bingo funciona sem clips).

interface TauriGlobal {
  core: { invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> };
  window?: {
    getCurrentWindow: () => { onCloseRequested: (cb: () => void | Promise<void>) => Promise<() => void> };
  };
  event: { listen: <T>(name: string, cb: (e: { payload: T }) => void) => Promise<() => void> };
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

export const isDesktop = (): boolean => typeof window !== "undefined" && !!window.__TAURI__;

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = window.__TAURI__;
  if (!tauri) return Promise.reject(new Error("disponível só no app de desktop"));
  return tauri.core.invoke<T>(cmd, args);
}
