import { invoke } from "./desktop";

export type ObsErrorCode =
  | "unreachable"
  | "bad_password"
  | "replay_unavailable"
  | "save_failed"
  | "timeout"
  | "not_connected";

export class ObsError extends Error {
  constructor(
    readonly code: ObsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ObsError";
  }
}

export const OBS_URL = "ws://127.0.0.1:4455";
const OUTPUTS_EVENTS = 1 << 6; // obs-websocket: EventSubscription.Outputs (ReplayBufferSaved)

interface Response {
  ok: boolean;
  code: number;
  comment?: string;
  data: Record<string, unknown>;
}

async function sha256b64(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let bin = "";
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

/** Cliente mínimo do obs-websocket v5 (só o que o Binguey usa). */
export class ObsClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<string, (r: Response) => void>();
  private waiters: { type: string; resolve: (d: Record<string, unknown>) => void }[] = [];
  recordDir = "";
  obsVersion = "";
  onClose: (() => void) | null = null;

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(password: string, url = OBS_URL): Promise<void> {
    this.close();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, "obswebsocket.json");
      this.ws = ws;
      let settled = false;
      let opened = false;
      const fail = (e: ObsError) => {
        if (settled) return;
        settled = true;
        reject(e);
      };
      ws.onerror = () =>
        fail(new ObsError("unreachable", "Não consegui falar com o OBS. Ele está aberto e com o WebSocket ativado?"));
      ws.onclose = (ev) => {
        this.pending.forEach((done) => done({ ok: false, code: -1, comment: "conexão fechada", data: {} }));
        this.pending.clear();
        if (ev.code === 4009) fail(new ObsError("bad_password", "Senha do WebSocket incorreta."));
        else fail(new ObsError("unreachable", "Conexão com o OBS encerrada."));
        if (opened) this.onClose?.(); // só avisa queda de uma conexão que estava ativa
      };
      ws.onmessage = async (ev) => {
        const { op, d } = JSON.parse(String(ev.data)) as { op: number; d: Record<string, any> };
        if (op === 0) {
          const identify: Record<string, unknown> = { rpcVersion: 1, eventSubscriptions: OUTPUTS_EVENTS };
          if (d.authentication) {
            const secret = await sha256b64(password + d.authentication.salt);
            identify.authentication = await sha256b64(secret + d.authentication.challenge);
          }
          ws.send(JSON.stringify({ op: 1, d: identify }));
        } else if (op === 2) {
          settled = true;
          opened = true;
          resolve();
        } else if (op === 5) {
          this.waiters.filter((w) => w.type === d.eventType).forEach((w) => w.resolve(d.eventData ?? {}));
        } else if (op === 7) {
          const done = this.pending.get(d.requestId);
          this.pending.delete(d.requestId);
          done?.({
            ok: d.requestStatus.result,
            code: d.requestStatus.code,
            comment: d.requestStatus.comment,
            data: d.responseData ?? {},
          });
        }
      };
    });
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
    }
  }

  private request(type: string, data?: Record<string, unknown>, timeoutMs = 10000): Promise<Response> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new ObsError("not_connected", "OBS desconectado."));
    return new Promise((resolve, reject) => {
      const id = String(this.nextId++);
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new ObsError("timeout", `O OBS não respondeu a ${type}.`));
      }, timeoutMs);
      this.pending.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } }));
    });
  }

  private waitEvent(type: string, ms: number): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const w = {
        type,
        resolve: (v: Record<string, unknown>) => {
          clearTimeout(timer);
          this.waiters = this.waiters.filter((x) => x !== w);
          resolve(v);
        },
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        reject(new ObsError("timeout", `Evento ${type} não chegou em ${ms} ms.`));
      }, ms);
      this.waiters.push(w);
    });
  }

  /** Lê versão e pasta de gravação (liberando-a para o app) e garante o Replay Buffer ligado. */
  async prepare(): Promise<void> {
    const version = await this.request("GetVersion");
    this.obsVersion = String(version.data.obsVersion ?? "");

    const dir = await this.request("GetRecordDirectory");
    this.recordDir = await invoke<string>("set_record_dir", { dir: String(dir.data.recordDirectory) });

    await this.ensureReplayBuffer();
  }

  async ensureReplayBuffer(): Promise<void> {
    let status = await this.request("GetReplayBufferStatus");
    if (!status.ok) {
      throw new ObsError(
        "replay_unavailable",
        "O Replay Buffer não está habilitado. No OBS: Configurações → Saída → marque “Habilitar Buffer de Repetição”.",
      );
    }
    if (status.data.outputActive) return;
    const start = await this.request("StartReplayBuffer");
    if (!start.ok) throw new ObsError("replay_unavailable", `Não consegui ligar o Replay Buffer: ${start.comment ?? start.code}`);
    for (let i = 0; i < 20 && !status.data.outputActive; i++) {
      await new Promise((r) => setTimeout(r, 250));
      status = await this.request("GetReplayBufferStatus");
    }
  }

  /** Pede ao OBS para salvar o replay e devolve o caminho do arquivo. */
  async saveReplay(): Promise<string> {
    const attempt = async () => {
      const saved = this.waitEvent("ReplayBufferSaved", 15000);
      saved.catch(() => {});
      const r = await this.request("SaveReplayBuffer");
      if (!r.ok) throw new ObsError("save_failed", `SaveReplayBuffer falhou: ${r.comment ?? r.code}`);
      return (await saved).savedReplayPath as string;
    };
    try {
      return await attempt();
    } catch (e) {
      if (e instanceof ObsError && e.code === "save_failed") {
        await this.ensureReplayBuffer(); // o usuário pode ter parado o buffer
        return attempt();
      }
      throw e;
    }
  }
}

export const obs = new ObsClient();
