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
export const PROFILE = "Binguey";
const PREV_PROFILE_KEY = "binguey:obs-prev-profile";
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

  // ---- Perfil dedicado do Binguey ---------------------------------------------------------------

  /** Aviso (não impede o uso) quando o perfil dedicado não pôde ser configurado. */
  profileNote = "";

  private async param(category: string, name: string): Promise<string> {
    const r = await this.request("GetProfileParameter", { parameterCategory: category, parameterName: name });
    return r.ok ? String(r.data.parameterValue ?? "") : "";
  }

  private async mustOk(type: string, data?: Record<string, unknown>): Promise<Response> {
    const r = await this.request(type, data);
    if (!r.ok) throw new ObsError("save_failed", `${type} falhou: ${r.comment ?? r.code}`);
    return r;
  }

  private async stopReplayBuffer(): Promise<void> {
    const s = await this.request("GetReplayBufferStatus");
    if (!s.ok || !s.data.outputActive) return;
    await this.request("StopReplayBuffer");
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const t = await this.request("GetReplayBufferStatus");
      if (!t.data.outputActive) return;
    }
  }

  /**
   * Usa um perfil só do Binguey (720p, 3 Mbps, buffer de 20 s, pasta Vídeos\Binguey), sem tocar no
   * perfil do usuário. Reaproveita dele o encoder (ex.: NVENC) e o tamanho da tela, para a cena continuar
   * igual. O nome do perfil anterior fica guardado para `restoreProfile`.
   */
  async useBingueyProfile(): Promise<void> {
    const list = await this.mustOk("GetProfileList");
    const current = String(list.data.currentProfileName);
    const profiles = (list.data.profiles ?? []) as string[];

    if (current === PROFILE && (await this.param("SimpleOutput", "VBitrate")) === "3000") {
      // Já configurado; só garante que o OBS criou a saída do Replay Buffer.
      if (!(await this.request("GetReplayBufferStatus")).ok) await this.reloadProfile();
      return;
    }

    let encoder = "";
    if (current !== PROFILE) {
      encoder = await this.param("SimpleOutput", "StreamEncoder");
      localStorage.setItem(PREV_PROFILE_KEY, current);
    }
    const video = await this.mustOk("GetVideoSettings");
    const baseW = Number(video.data.baseWidth);
    const baseH = Number(video.data.baseHeight);

    await this.stopReplayBuffer();
    if (current !== PROFILE) {
      await this.mustOk(profiles.includes(PROFILE) ? "SetCurrentProfile" : "CreateProfile", { profileName: PROFILE });
      await new Promise((r) => setTimeout(r, 500));
    }

    const params: [string, string, string][] = [
      ["Output", "Mode", "Simple"],
      ["SimpleOutput", "RecRB", "true"],
      ["SimpleOutput", "RecRBTime", "20"],
      ["SimpleOutput", "RecRBSize", "512"],
      ["SimpleOutput", "RecQuality", "Stream"],
      ["SimpleOutput", "RecFormat2", "hybrid_mp4"],
      ["SimpleOutput", "VBitrate", "3000"],
    ];
    if (encoder) params.push(["SimpleOutput", "StreamEncoder", encoder]);
    for (const [parameterCategory, parameterName, parameterValue] of params) {
      await this.mustOk("SetProfileParameter", { parameterCategory, parameterName, parameterValue });
    }

    const outputHeight = Math.min(720, baseH);
    const outputWidth = Math.round((outputHeight * baseW) / baseH / 2) * 2; // largura par
    await this.mustOk("SetVideoSettings", {
      baseWidth: baseW,
      baseHeight: baseH,
      outputWidth,
      outputHeight,
      fpsNumerator: 30,
      fpsDenominator: 1,
    });
    await this.mustOk("SetRecordDirectory", { recordDirectory: await invoke<string>("default_clips_dir") });

    // O OBS só cria a saída do Replay Buffer ao carregar o perfil; se ainda não existe, recarrega.
    if (!(await this.request("GetReplayBufferStatus")).ok) await this.reloadProfile();
  }

  /** Recarrega o perfil do Binguey trocando para outro perfil e voltando. */
  private async reloadProfile(): Promise<void> {
    const list = await this.mustOk("GetProfileList");
    const profiles = (list.data.profiles ?? []) as string[];
    const saved = localStorage.getItem(PREV_PROFILE_KEY);
    const other = saved && profiles.includes(saved) ? saved : profiles.find((p) => p !== PROFILE);
    if (!other) return;
    await this.stopReplayBuffer();
    await this.mustOk("SetCurrentProfile", { profileName: other });
    await new Promise((r) => setTimeout(r, 800));
    await this.mustOk("SetCurrentProfile", { profileName: PROFILE });
    await new Promise((r) => setTimeout(r, 800));
  }

  /** Volta ao perfil que o usuário usava antes (se o Binguey o trocou). Melhor esforço. */
  async restoreProfile(): Promise<void> {
    const previous = localStorage.getItem(PREV_PROFILE_KEY);
    if (!previous || !this.connected) return;
    try {
      const list = await this.request("GetProfileList");
      const profiles = (list.data.profiles ?? []) as string[];
      if (list.data.currentProfileName === PROFILE && profiles.includes(previous)) {
        await this.stopReplayBuffer();
        await this.request("SetCurrentProfile", { profileName: previous });
      }
      localStorage.removeItem(PREV_PROFILE_KEY);
    } catch {
      /* se o OBS não responder, o perfil volta quando o usuário trocar manualmente */
    }
  }

  /** Resumo do que está valendo no OBS agora (para o teste automático). */
  async describeSetup(): Promise<string> {
    const list = await this.request("GetProfileList");
    const video = await this.request("GetVideoSettings");
    const dir = await this.request("GetRecordDirectory");
    return (
      `perfil=${list.data.currentProfileName} · saída=${video.data.outputWidth}x${video.data.outputHeight}` +
      `@${video.data.fpsNumerator}/${video.data.fpsDenominator} · bitrate=${await this.param("SimpleOutput", "VBitrate")}` +
      ` · buffer=${await this.param("SimpleOutput", "RecRBTime")}s · pasta=${dir.data.recordDirectory}`
    );
  }

  /** Lê versão e pasta de gravação (liberando-a para o app) e garante o Replay Buffer ligado. */
  async prepare(): Promise<void> {
    const version = await this.request("GetVersion");
    this.obsVersion = String(version.data.obsVersion ?? "");

    this.profileNote = "";
    try {
      await this.useBingueyProfile();
    } catch (e) {
      // Sem o perfil dedicado o app ainda funciona com a configuração atual do usuário.
      this.profileNote = `Não consegui preparar o perfil do Binguey no OBS (${e instanceof Error ? e.message : e}). Usando a sua configuração atual.`;
    }

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

  /**
   * Tipos de fonte de vídeo ativos na cena atual (ex.: "game_capture", "monitor_capture").
   * Melhor esforço: devolve [] se o OBS não responder.
   */
  async activeCaptureKinds(): Promise<string[]> {
    try {
      const scene = await this.request("GetCurrentProgramScene");
      if (!scene.ok) return [];
      const items = await this.request("GetSceneItemList", { sceneName: scene.data.sceneName });
      const list = (items.data.sceneItems ?? []) as { inputKind?: string; sceneItemEnabled?: boolean }[];
      return list.filter((i) => i.sceneItemEnabled !== false && i.inputKind).map((i) => i.inputKind as string);
    } catch {
      return [];
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
