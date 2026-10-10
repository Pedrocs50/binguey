// Spike S2: (1) o WebView conecta no OBS sem bloqueio de CSP; (2) o app lê o clip
// só dentro da pasta de gravação (comando Rust read_clip), e recusa o resto.
const { invoke } = window.__TAURI__.core;
const $ = (id) => document.getElementById(id);
const OBS_URL = "ws://127.0.0.1:4455";

let ws;
let nextId = 1;
let recordDir = "";
const pending = new Map();
const waiters = [];

function log(msg) {
  $("log").textContent += msg + "\n";
  void invoke("spike_report", { line: msg });
}

async function sha256b64(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function connect(password) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(OBS_URL, "obswebsocket.json");
    ws.onerror = () => reject(new Error("não conectou: CSP, OBS fechado ou WebSocket desligado"));
    ws.onclose = (e) => {
      if (e.code === 4009) reject(new Error("senha incorreta"));
    };
    ws.onmessage = async (ev) => {
      const { op, d } = JSON.parse(ev.data);
      if (op === 0) {
        const identify = { rpcVersion: 1, eventSubscriptions: 1 << 6 };
        if (d.authentication) {
          const secret = await sha256b64(password + d.authentication.salt);
          identify.authentication = await sha256b64(secret + d.authentication.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d: identify }));
      } else if (op === 2) {
        resolve();
      } else if (op === 5) {
        waiters.filter((w) => w.type === d.eventType).forEach((w) => w.resolve(d.eventData ?? {}));
      } else if (op === 7) {
        const done = pending.get(d.requestId);
        pending.delete(d.requestId);
        done?.({ ok: d.requestStatus.result, code: d.requestStatus.code, comment: d.requestStatus.comment, data: d.responseData ?? {} });
      }
    };
  });
}

const request = (type, data) =>
  new Promise((resolve) => {
    const id = String(nextId++);
    pending.set(id, resolve);
    ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } }));
  });

function waitEvent(type, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`evento ${type} não chegou em ${ms} ms`)), ms);
    waiters.push({ type, resolve: (v) => { clearTimeout(t); resolve(v); } });
  });
}

async function connectAndPrepare(password) {
  await connect(password);
  log("S2.1 PASS  conexão com o OBS aberta pelo WebView (CSP não bloqueou)");
  const v = await request("GetVersion");
  log(`  OBS ${v.data.obsVersion} · obs-websocket ${v.data.obsWebSocketVersion}`);
  const dir = await request("GetRecordDirectory");
  recordDir = await invoke("set_record_dir", { dir: dir.data.recordDirectory });
  log(`  pasta de gravação permitida: ${recordDir}`);
  let st = await request("GetReplayBufferStatus");
  if (!st.ok) throw new Error(`Replay Buffer indisponível (${st.code}): habilite em Configurações → Saída`);
  if (!st.data.outputActive) {
    await request("StartReplayBuffer");
    for (let i = 0; i < 20 && !st.data.outputActive; i++) {
      await new Promise((r) => setTimeout(r, 250));
      st = await request("GetReplayBufferStatus");
    }
  }
}

async function saveAndRead() {
  const t0 = performance.now();
  const saved = waitEvent("ReplayBufferSaved", 15000);
  saved.catch(() => {});
  const r = await request("SaveReplayBuffer");
  if (!r.ok) throw new Error(`SaveReplayBuffer falhou (${r.code}): ${r.comment}`);
  const { savedReplayPath: file } = await saved;
  const tSave = Math.round(performance.now() - t0);
  const bytes = new Uint8Array(await invoke("read_clip", { path: file }));
  const tRead = Math.round(performance.now() - t0);
  const ftyp = new TextDecoder().decode(bytes.slice(4, 8));
  log(`S2.2 PASS  leu ${file}`);
  log(`  ${(bytes.length / 1024 / 1024).toFixed(2)} MB · assinatura mp4 (ftyp): ${ftyp === "ftyp" ? "ok" : "INVÁLIDA"}`);
  log(`  salvar: ${tSave} ms · salvar+ler: ${tRead} ms`);
}

async function readOutside() {
  for (const path of ["C:/Windows/win.ini", `${recordDir}\\..\\Windows\\win.ini`]) {
    try {
      await invoke("read_clip", { path });
      log(`S2.3 FAIL  leu fora da pasta: ${path}`);
    } catch (e) {
      log(`S2.3 PASS  recusou ${path} -> ${e}`);
    }
  }
}

function guard(button, fn) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await fn();
    } catch (e) {
      log(`ERRO: ${e.message ?? e}`);
    }
    button.disabled = false;
  });
}

guard($("conectar"), async () => {
  await connectAndPrepare($("senha").value);
  $("salvar").disabled = false;
  $("fora").disabled = false;
});
guard($("salvar"), saveAndRead);
guard($("fora"), readOutside);

(async () => {
  const cfg = await invoke("spike_config");
  if (cfg.password) $("senha").value = cfg.password;
  if (!cfg.auto) return;
  try {
    await connectAndPrepare(cfg.password);
    await new Promise((r) => setTimeout(r, 2000));
    await saveAndRead();
    await readOutside();
    log("FIM");
  } catch (e) {
    log(`ERRO: ${e.message ?? e}`);
    log("FIM");
  }
  await invoke("spike_exit");
})();
