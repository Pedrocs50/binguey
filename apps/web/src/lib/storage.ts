// localStorage só para conveniências por navegador; tudo funciona sem ele.

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado ou bloqueado: ignora */
  }
}

export const getNickname = () => read("binguey:nick") ?? "";
export const setNickname = (n: string) => write("binguey:nick", n);

// Senha do WebSocket do OBS: fica só neste computador e nunca é enviada ao servidor.
export const getObsPassword = () => read("binguey:obs-pass") ?? "";
export const setObsPassword = (p: string) => write("binguey:obs-pass", p);

export interface RecentRoom {
  code: string;
  at: number;
}

export function getRecentRooms(): RecentRoom[] {
  try {
    const parsed: unknown = JSON.parse(read("binguey:recent") ?? "[]");
    return Array.isArray(parsed) ? (parsed as RecentRoom[]).filter((r) => typeof r?.code === "string") : [];
  } catch {
    return [];
  }
}

export function rememberRoom(code: string) {
  const rest = getRecentRooms().filter((r) => r.code !== code);
  write("binguey:recent", JSON.stringify([{ code, at: Date.now() }, ...rest].slice(0, 5)));
}
