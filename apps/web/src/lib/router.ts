import { useSyncExternalStore } from "react";

const EVENT = "binguey:navigate";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function navigate(to: string, replace = false) {
  if (to === window.location.pathname) return;
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo(0, 0);
}

/** Casa /r/ABC123 com o padrão /r/:code e devolve o parâmetro, ou null. */
export function matchPath(path: string, prefix: string): string | null {
  const m = new RegExp(`^/${prefix}/([^/]+)/?$`).exec(path);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}
