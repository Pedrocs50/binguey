// Gera os prints do README (docs/img/*.png) jogando uma partida de verdade no site publicado, com um
// navegador sem interface (Edge) controlado por CDP e um segundo jogador (o bot). Nada de dados reais:
// os apelidos são "Ana" e "Bruno".
//   node --env-file=.env.local scripts/capture-readme.mjs [https://binguey.pages.dev]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE = process.argv[2] ?? "https://binguey.pages.dev";
const OUT = new URL("../docs/img/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "binguey-shots-"));
const edge = spawn(EDGE, [`--headless=new`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === "page");
      if (t) return t;
    } catch {}
    await sleep(500);
  }
  throw new Error("Edge não abriu");
}
const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
let onDialog = null;
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  else if (m.method === "Page.javascriptDialogOpening") void send("Page.handleJavaScriptDialog", { accept: true });
};
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const waitFor = async (expr, ms = 20000, label = expr) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(300); }
  throw new Error(`esperei demais por: ${label}`);
};
const view = (width, height, mobile = false) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
const nav = async (url) => { await send("Page.navigate", { url }); await sleep(2500); };
async function shot(name, height) {
  const r = await send("Page.captureScreenshot", { format: "png", ...(height ? { clip: { x: 0, y: 0, width: (await ev("innerWidth")), height, scale: 1 } } : {}) });
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  console.log("salvo", name);
}
const SET = `function setVal(el, v) { const p = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }
  function field(label) { return [...document.querySelectorAll('label.campo')].find((l) => l.textContent.includes(label)).querySelector('input,select'); }
  function btn(text) { return [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text); }`;

async function createRoom(nick, size, lines, mode = "lines") {
  await nav(SITE);
  await ev(`(() => { ${SET} setVal(field('seu apelido'), ${JSON.stringify(nick)}); setVal(field('tabuleiro'), '${size}'); if ('${mode}' === 'full') setVal(field('como vencer'), 'full'); else setVal(field('linhas para vencer'), '${lines}'); return true; })()`);
  await sleep(300);
  await ev(`(() => { ${SET} btn('criar sala').click(); return true; })()`);
  await waitFor(`location.pathname.startsWith('/r/')`, 20000, "sala criada");
  return (await ev("location.pathname")).split("/")[2];
}
const clickCell = (i) => ev(`document.querySelectorAll('.casa')[${i}].click()`);
const startMatch = async () => { await ev(`(() => { ${SET} btn('iniciar partida').click(); return true; })()`); await waitFor(`!!document.querySelector('.tabuleiro')`, 20000, "tabuleiro"); };

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await view(1000, 900);

  // 1) início
  await nav(SITE);
  await sleep(1000);
  await shot("01-inicio.png", 880);

  // 2) sala 4x4 com a Bruno entrando: lobby
  const code = await createRoom("Ana", 4, 2);
  const bot = spawn(process.execPath, [`--env-file=${ROOT}.env.local`, `${ROOT}packages/shared/scripts/bot.mjs`, code, "Bruno", "1,6,11,2,13,8"], { cwd: ROOT, stdio: "inherit" });
  await waitFor(`document.body.innerText.includes('na sala (2)')`, 30000, "Bruno na sala");
  await sleep(800);
  await shot("02-lobby.png", 900);

  // 3) partida em andamento
  await startMatch();
  for (const i of [0, 5, 10, 15]) { await clickCell(i); await sleep(600); }
  await waitFor(`document.querySelectorAll('.casa.marcada').length >= 9`, 40000, "marcações do bot");
  await sleep(1500);
  await shot("03-partida.png", 760);

  // 4) celular
  await view(390, 844, true);
  await sleep(1500);
  await shot("04-celular.png");

  // 5) mini-tabuleiro (janela do app), usando a sala em andamento
  await view(420, 640);
  await ev(`localStorage.setItem('binguey:active-room', ${JSON.stringify(code)})`);
  await nav(`${SITE}/overlay`);
  await waitFor(`!!document.querySelector('.overlay .tabuleiro')`, 20000, "mini-tabuleiro");
  await sleep(800);
  await shot("06-mini-tabuleiro.png", 404);

  // encerra a sala 1 e faz uma sala 3x3 com vitória
  await view(1000, 900);
  await nav(`${SITE}/r/${code}`);
  await waitFor(`!!document.querySelector('.tabuleiro')`, 20000);
  await ev(`(() => { ${SET} btn('encerrar partida').click(); return true; })()`);
  await sleep(1500);
  bot.kill();

  const code2 = await createRoom("Ana", 3, 1);
  await startMatch();
  for (const i of [3, 4, 5]) { await clickCell(i); await sleep(700); }
  await waitFor(`document.body.innerText.includes('vitória')`, 20000, "vitória");
  await sleep(1200);
  await shot("05-vitoria.png", 900);
  // modo cartela cheia: cria a sala e confere o texto do modo
  const code3 = await createRoom("Ana", 3, 1, "full");
  const lobbyText = await ev("document.body.innerText");
  console.log("cartela cheia na sala:", lobbyText.includes("vence com a cartela cheia") ? "OK" : "FALHOU");
  console.log("salas usadas:", code, code2, code3);
} finally {
  try { ws.close(); } catch {}
  edge.kill();
  await sleep(1000);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.exit(0);
