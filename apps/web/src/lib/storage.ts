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

/**
 * O que o OBS grava. O jogador abre e fecha jogos durante a partida, então a captura precisa seguir
 * qualquer jogo:
 * - display: grava o monitor principal (funciona com qualquer jogo, janela ou tela cheia; mostra também
 *   notificações e outras janelas);
 * - game: Captura de Jogo em "qualquer aplicativo em tela cheia" (só o jogo; não pega jogo em janela);
 * - mine: usa a cena que o jogador já tem no OBS, sem criar nada.
 */
export type CaptureMode = "display" | "game" | "mine";

export interface Settings {
  /** Apagar o arquivo local do replay depois que o clip foi enviado. Padrão: guardar (é o seu momento). */
  deleteLocalAfterUpload: boolean;
  captureMode: CaptureMode;
}

export function getSettings(): Settings {
  try {
    const parsed = JSON.parse(read("binguey:settings") ?? "{}") as Partial<Settings>;
    return {
      deleteLocalAfterUpload: parsed.deleteLocalAfterUpload === true,
      captureMode: parsed.captureMode === "game" || parsed.captureMode === "mine" ? parsed.captureMode : "display",
    };
  } catch {
    return { deleteLocalAfterUpload: false, captureMode: "display" };
  }
}
export const setSettings = (s: Settings) => write("binguey:settings", JSON.stringify(s));

/** Sala em que o jogador está agora; o mini-tabuleiro (outra janela) lê daqui. */
export const getActiveRoom = () => read("binguey:active-room") ?? "";
export const setActiveRoom = (code: string) => write("binguey:active-room", code);

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
