// Spike S1: o OBS salva o replay por comando e dizemos onde o arquivo foi parar?
// Critério (docs/analise-inicial.md): clip em menos de 3 s; caminho vem do evento
// ReplayBufferSaved (ou de GetLastReplayBufferReplay).
//
// Uso (na raiz do repositório, com o OBS aberto e o Replay Buffer habilitado):
//   node --env-file=.env.local apps/desktop/spikes/s1-obs-replay.mjs          # Enter salva; q sai
//   node --env-file=.env.local apps/desktop/spikes/s1-obs-replay.mjs --auto   # salva uma vez e sai
// Variáveis (em .env.local, nunca no código): OBS_PASSWORD, opcionais OBS_HOST e OBS_PORT.
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const host = process.env.OBS_HOST ?? "127.0.0.1";
const port = process.env.OBS_PORT ?? "4455";
const password = process.env.OBS_PASSWORD ?? "";
const auto = process.argv.includes("--auto");
const sha256b64 = (s) => createHash("sha256").update(s).digest("base64");

const ws = new WebSocket(`ws://${host}:${port}`, "obswebsocket.json");
const pending = new Map();
const waiters = [];
let nextId = 1;
let onReady;
const ready = new Promise((res) => (onReady = res));

function fail(msg) {
  console.error(`\nERRO: ${msg}`);
  process.exit(1);
}

ws.addEventListener("error", () => fail(`não consegui conectar em ws://${host}:${port}. O OBS está aberto e o WebSocket ativado?`));
ws.addEventListener("close", (e) => {
  if (e.code === 4009) fail("senha incorreta (OBS_PASSWORD em .env.local).");
  if (!ready.settled) fail(`conexão fechada (código ${e.code}).`);
});

ws.addEventListener("message", (ev) => {
  const { op, d } = JSON.parse(String(ev.data));
  if (op === 0) {
    const identify = { rpcVersion: 1, eventSubscriptions: 1 << 6 }; // 1<<6 = Outputs (replay buffer)
    if (d.authentication) {
      const secret = sha256b64(password + d.authentication.salt);
      identify.authentication = sha256b64(secret + d.authentication.challenge);
    }
    ws.send(JSON.stringify({ op: 1, d: identify }));
  } else if (op === 2) {
    ready.settled = true;
    onReady();
  } else if (op === 5) {
    for (const w of waiters.filter((x) => x.type === d.eventType)) w.resolve(d.eventData ?? {});
  } else if (op === 7) {
    const p = pending.get(d.requestId);
    pending.delete(d.requestId);
    p?.({ ok: d.requestStatus.result, code: d.requestStatus.code, comment: d.requestStatus.comment, data: d.responseData ?? {} });
  }
});

const request = (type, data) =>
  new Promise((resolve) => {
    const id = String(nextId++);
    pending.set(id, resolve);
    ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } }));
  });

function waitEvent(type, ms) {
  return new Promise((resolve, reject) => {
    const w = { type, resolve: (v) => { clearTimeout(t); resolve(v); } };
    const t = setTimeout(() => reject(new Error(`evento ${type} não chegou em ${ms} ms`)), ms);
    waiters.push(w);
  });
}

await ready;
const version = await request("GetVersion");
console.log(`OBS ${version.data.obsVersion} · obs-websocket ${version.data.obsWebSocketVersion} · ${version.data.platform}`);

const dirRes = await request("GetRecordDirectory");
const recordDir = dirRes.data.recordDirectory;
console.log(`Pasta de gravação: ${recordDir}`);

let status = await request("GetReplayBufferStatus");
if (!status.ok) fail(`GetReplayBufferStatus falhou (${status.code}): ${status.comment}\n→ Habilite o Replay Buffer em Configurações → Saída.`);
if (!status.data.outputActive) {
  console.log("Replay Buffer parado; ligando por comando...");
  const start = await request("StartReplayBuffer");
  if (!start.ok) fail(`StartReplayBuffer falhou (${start.code}): ${start.comment}`);
  for (let i = 0; i < 20 && !status.data.outputActive; i++) {
    await new Promise((r) => setTimeout(r, 250));
    status = await request("GetReplayBufferStatus");
  }
}
console.log(`Replay Buffer ativo: ${status.data.outputActive}`);

async function saveOnce() {
  const t0 = performance.now();
  const saved = waitEvent("ReplayBufferSaved", 15000);
  saved.catch(() => {}); // evita aviso se o request falhar antes
  const r = await request("SaveReplayBuffer");
  if (!r.ok) return console.log(`SaveReplayBuffer falhou (${r.code}): ${r.comment}`);

  let file;
  let via = "evento ReplayBufferSaved";
  try {
    file = (await saved).savedReplayPath;
  } catch (e) {
    console.log(`(${e.message}; tentando GetLastReplayBufferReplay)`);
  }
  const ms = Math.round(performance.now() - t0);
  if (!file) {
    via = "GetLastReplayBufferReplay";
    file = (await request("GetLastReplayBufferReplay")).data.savedReplayPath;
  }
  if (!file) return console.log("Não consegui descobrir o caminho do arquivo.");

  const inside = path.resolve(file).toLowerCase().startsWith(path.resolve(recordDir).toLowerCase());
  const size = (await stat(file)).size;
  console.log(`\nClip salvo em ${ms} ms (${ms < 3000 ? "OK, < 3 s" : "LENTO, > 3 s"})`);
  console.log(`  arquivo: ${file}`);
  console.log(`  via: ${via}`);
  console.log(`  tamanho: ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  dentro da pasta de gravação: ${inside ? "sim" : "NÃO"}`);
}

if (auto) {
  console.log("Modo --auto: salvando em 3 s...");
  await new Promise((r) => setTimeout(r, 3000));
  await saveOnce();
  ws.close();
  process.exit(0);
}

console.log("\nEnter = salvar replay agora · q + Enter = sair");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (line.trim().toLowerCase() === "q") process.exit(0);
  await saveOnce();
});
