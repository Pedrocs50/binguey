import { invoke } from "./desktop";
import { getSettings, type CaptureMode } from "./storage";

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
export const COLLECTION = "Binguey";
const PREV_COLLECTION_KEY = "binguey:obs-prev-collection";
/** Uma fonte por modo; trocar de modo só liga uma e desliga a outra (o OBS demora a liberar nomes removidos). */
const CAPTURE_SOURCES: Record<Exclude<CaptureMode, "mine">, { name: string; kind: string }> = {
  display: { name: "Binguey: monitor", kind: "monitor_capture" },
  game: { name: "Binguey: jogo", kind: "game_capture" },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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

  /** Saídas do OBS em uso agora (transmissão, gravação, câmera virtual, replay buffer). */
  async activeOutputs(): Promise<string[]> {
    const checks: [string, string][] = [
      ["transmissão", "GetStreamStatus"],
      ["gravação", "GetRecordStatus"],
      ["câmera virtual", "GetVirtualCamStatus"],
      ["replay buffer", "GetReplayBufferStatus"],
    ];
    const active: string[] = [];
    for (const [name, type] of checks) {
      const r = await this.request(type).catch(() => null);
      if (r?.ok && r.data.outputActive) active.push(name);
    }
    return active;
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

    const busy = (await this.activeOutputs()).filter((n) => n !== "replay buffer");
    if (busy.length > 0) {
      throw new ObsError("save_failed", `o OBS está em uso (${busy.join(", ")}); não troco o perfil nem a cena enquanto isso`);
    }

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

    await this.stopReplayBuffer(); // o OBS pode ter religado o buffer ao carregar o perfil
    const outputHeight = Math.min(720, baseH);
    const outputWidth = Math.round((outputHeight * baseW) / baseH / 2) * 2; // largura par
    const setVideo = await this.request("SetVideoSettings", {
      baseWidth: baseW,
      baseHeight: baseH,
      outputWidth,
      outputHeight,
      fpsNumerator: 30,
      fpsDenominator: 1,
    });
    if (!setVideo.ok) {
      throw new ObsError("save_failed", `SetVideoSettings falhou (${setVideo.comment ?? setVideo.code}); saídas ativas: ${(await this.activeOutputs()).join(", ") || "nenhuma"}`);
    }
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

  // ---- Cena do Binguey: captura que acompanha qualquer jogo ----------------------------------------

  /**
   * Monta uma coleção de cenas só do Binguey com UMA fonte de captura que funciona para qualquer jogo
   * que o jogador abrir ou fechar (monitor principal, ou Captura de Jogo em "qualquer aplicativo em tela
   * cheia"). No modo "mine" não cria nada e devolve a coleção do jogador, se estava em outra.
   */
  async useBingueyScene(mode: CaptureMode): Promise<void> {
    if (mode === "mine") return this.restoreCollection();

    const list = await this.mustOk("GetSceneCollectionList");
    const current = String(list.data.currentSceneCollectionName);
    const collections = (list.data.sceneCollections ?? []) as string[];
    if (current !== COLLECTION) {
      localStorage.setItem(PREV_COLLECTION_KEY, current);
      await this.stopReplayBuffer();
      await this.mustOk(collections.includes(COLLECTION) ? "SetCurrentSceneCollection" : "CreateSceneCollection", {
        sceneCollectionName: COLLECTION,
      });
      await sleep(1000);
    }

    const scenes = await this.mustOk("GetSceneList");
    const names = ((scenes.data.scenes ?? []) as { sceneName: string }[]).map((s) => s.sceneName);
    if (!names.includes(COLLECTION)) await this.mustOk("CreateScene", { sceneName: COLLECTION });
    await this.mustOk("SetCurrentProgramScene", { sceneName: COLLECTION });

    const items = await this.mustOk("GetSceneItemList", { sceneName: COLLECTION });
    const list2 = (items.data.sceneItems ?? []) as { sourceName: string; sceneItemId: number }[];
    const setEnabled = (sceneItemId: number, sceneItemEnabled: boolean) =>
      this.request("SetSceneItemEnabled", { sceneName: COLLECTION, sceneItemId, sceneItemEnabled });

    // Desliga toda fonte "Binguey: ..." que não seja a do modo escolhido (inclui nomes de versões antigas)
    // e liga (criando, se preciso) a do modo.
    const want = CAPTURE_SOURCES[mode];
    for (const item of list2) {
      if (item.sourceName.startsWith("Binguey: ") && item.sourceName !== want.name) {
        await setEnabled(item.sceneItemId, false);
      }
    }
    const existing = list2.find((i) => i.sourceName === want.name);
    if (existing) {
      await setEnabled(existing.sceneItemId, true);
      if (want.kind === "monitor_capture") await this.ensureMonitor(want.name); // versões antigas criavam sem monitor
      return;
    }

    const created = await this.mustOk("CreateInput", {
      sceneName: COLLECTION,
      inputName: want.name,
      inputKind: want.kind,
      inputSettings: want.kind === "game_capture" ? { capture_mode: "any_fullscreen" } : {},
      sceneItemEnabled: true,
    });
    if (want.kind === "monitor_capture") await this.ensureMonitor(want.name);
    // Encaixa a captura na tela da cena (escala proporcional, sem cortar).
    const video = await this.mustOk("GetVideoSettings");
    await this.request("SetSceneItemTransform", {
      sceneName: COLLECTION,
      sceneItemId: created.data.sceneItemId,
      sceneItemTransform: {
        positionX: 0,
        positionY: 0,
        alignment: 5,
        boundsType: "OBS_BOUNDS_SCALE_INNER",
        boundsAlignment: 0,
        boundsWidth: Number(video.data.baseWidth),
        boundsHeight: Number(video.data.baseHeight),
      },
    });
  }

  /**
   * Uma captura de monitor criada pelo WebSocket nasce SEM monitor escolhido (fonte 0x0, vídeo preto).
   * Escolhe o monitor principal; se o OBS não disser qual é, o primeiro da lista.
   */
  private async ensureMonitor(inputName: string): Promise<void> {
    const current = await this.request("GetInputSettings", { inputName });
    if (current.ok && (current.data.inputSettings as { monitor_id?: string } | undefined)?.monitor_id) return;
    const items = await this.request("GetInputPropertiesListPropertyItems", { inputName, propertyName: "monitor_id" });
    const list = (items.data.propertyItems ?? []) as { itemName: string; itemValue: string }[];
    if (!items.ok || list.length === 0) throw new ObsError("save_failed", "o OBS não listou nenhum monitor para capturar");
    const main = list.find((i) => /principal|primary/i.test(i.itemName)) ?? list[0]!;
    await this.mustOk("SetInputSettings", { inputName, inputSettings: { monitor_id: main.itemValue }, overlay: true });
  }

  /** Tamanho da imagem que a fonte de captura ativa está recebendo (0x0 = sem imagem). */
  async captureSize(): Promise<{ width: number; height: number }> {
    try {
      const items = await this.request("GetSceneItemList", { sceneName: COLLECTION });
      const item = ((items.data.sceneItems ?? []) as { sourceName: string; sceneItemId: number; sceneItemEnabled?: boolean }[]).find(
        (i) => i.sceneItemEnabled !== false && i.sourceName.startsWith("Binguey: "),
      );
      if (!item) return { width: 0, height: 0 };
      const t = await this.request("GetSceneItemTransform", { sceneName: COLLECTION, sceneItemId: item.sceneItemId });
      const tr = t.data.sceneItemTransform as { sourceWidth: number; sourceHeight: number };
      return { width: tr.sourceWidth, height: tr.sourceHeight };
    } catch {
      return { width: 0, height: 0 };
    }
  }

  /** Devolve a coleção de cenas que o jogador usava (se o Binguey a trocou). Melhor esforço. */
  async restoreCollection(): Promise<void> {
    const previous = localStorage.getItem(PREV_COLLECTION_KEY);
    if (!previous || !this.connected) return;
    try {
      const list = await this.request("GetSceneCollectionList");
      const collections = (list.data.sceneCollections ?? []) as string[];
      if (list.data.currentSceneCollectionName === COLLECTION && collections.includes(previous)) {
        await this.stopReplayBuffer();
        await this.request("SetCurrentSceneCollection", { sceneCollectionName: previous });
        await sleep(1000);
      }
      localStorage.removeItem(PREV_COLLECTION_KEY);
    } catch {
      /* se o OBS não responder, o jogador troca manualmente */
    }
  }

  /** Volta ao perfil e à coleção de cenas que o usuário usava antes. Melhor esforço. */
  async restoreProfile(): Promise<void> {
    await this.restoreCollection();
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
      ` · buffer=${await this.param("SimpleOutput", "RecRBTime")}s · pasta=${dir.data.recordDirectory}` +
      ` · coleção=${(await this.request("GetSceneCollectionList")).data.currentSceneCollectionName}` +
      ` · fontes=${(await this.activeCaptureKinds()).join("+") || "nenhuma"}`
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

    try {
      await this.useBingueyScene(getSettings().captureMode);
    } catch (e) {
      this.profileNote += ` Não consegui montar a cena do Binguey (${e instanceof Error ? e.message : e}). Usando a sua cena atual.`;
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
