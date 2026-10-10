// Jogador de teste: entra numa sala pelo código, espera a partida começar e marca casas.
// Uso: pnpm --filter @binguey/shared bot -- CODIGO [Apelido] [casa,casa,...]
import { createClient } from "@supabase/supabase-js";

const [code, nick = "Bot", cellsArg = "4,0"] = process.argv.slice(2);
if (!code) throw new Error("Uso: bot CODIGO [Apelido] [casas]");
const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

must(await c.auth.signInAnonymously(), "login");
must(await c.rpc("upsert_profile", { p_nickname: nick }), "perfil");
const room = must(await c.rpc("join_room", { p_code: code }), "entrar");
console.log(`${nick} entrou na sala ${room.code}; aguardando início...`);

let status = room.status;
while (status === "lobby") {
  await sleep(1500);
  status = must(await c.from("rooms").select("status").eq("id", room.id).single(), "status").status;
}
for (const idx of cellsArg.split(",").map(Number)) {
  await sleep(2000);
  const r = await c.rpc("mark_cell", { p_room: room.id, p_idx: idx });
  console.log(r.error ? `casa ${idx}: ${r.error.message}` : `${nick} marcou a casa ${idx}`);
}
