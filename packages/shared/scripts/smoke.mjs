// Teste de fumaça do backend contra um projeto Supabase real (dev).
// Uso: pnpm --filter @binguey/shared smoke   (lê ../../.env.local)
// Cria usuários anônimos e uma sala de teste; a sala expira sozinha em 48 h.
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY");

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
};
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function user(nick) {
  const c = client();
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error("login anônimo falhou: " + error.message);
  if (nick) {
    const r = await c.rpc("upsert_profile", { p_nickname: nick });
    if (r.error) throw new Error("upsert_profile: " + r.error.message);
  }
  return c;
}
const errOf = (r) => r.error?.message ?? "";

const A = await user("Alice");
const B = await user("Bruno");
const C = await user("Carla"); // nunca entra na sala
const anon = client(); // sem sessão

// --- sala e lobby
const created = await A.rpc("create_room", { p_size: 3, p_duration_s: 300, p_target_lines: 1, p_clip_policy: "optional" });
check("A cria sala 3x3", !created.error && /^[A-Z2-9]{6}$/.test(created.data?.code ?? ""), created.data?.code ?? errOf(created));
const room = created.data;

const joined = await B.rpc("join_room", { p_code: room.code.toLowerCase() });
check("B entra pelo código (minúsculo)", !joined.error, errOf(joined));
check("código inexistente é recusado", errOf(await C.rpc("join_room", { p_code: "ZZZZZZ" })).includes("room_not_found"));

const bRooms = await B.from("rooms").select("id");
const cRooms = await C.from("rooms").select("id");
check("B (membro) enxerga a sala", bRooms.data?.length === 1);
check("C (de fora) não enxerga salas", cRooms.data?.length === 0);

const names = await B.from("profiles").select("nickname");
check("B lê o apelido de quem divide sala", names.data?.some((p) => p.nickname === "Alice"), JSON.stringify(names.data));

// --- início
check("B (não anfitrião) não inicia", errOf(await B.rpc("start_room", { p_room: room.id })).includes("not_host"));
const started = await A.rpc("start_room", { p_room: room.id });
check("A inicia a partida", !started.error && started.data?.status === "running", errOf(started));
const cells = await B.from("cells").select("idx, goal_text").eq("room_id", room.id);
check("tabuleiro tem 9 casas", cells.data?.length === 9, String(cells.data?.length));
check("não dá para iniciar duas vezes", errOf(await A.rpc("start_room", { p_room: room.id })).includes("already_started"));

// --- marcações
check("A marca a casa 0", !(await A.rpc("mark_cell", { p_room: room.id, p_idx: 0 })).error);
check("B não marca a casa 0 de novo", errOf(await B.rpc("mark_cell", { p_room: room.id, p_idx: 0 })).includes("already_marked"));
check("casa inválida é recusada", errOf(await B.rpc("mark_cell", { p_room: room.id, p_idx: 99 })).includes("invalid_cell"));
check("C (de fora) não marca", errOf(await C.rpc("mark_cell", { p_room: room.id, p_idx: 3 })).includes("not_member"));
check("B marca a casa 1", !(await B.rpc("mark_cell", { p_room: room.id, p_idx: 1 })).error);
check("A marca a casa 2 (fecha a linha)", !(await A.rpc("mark_cell", { p_room: room.id, p_idx: 2 })).error);

const after = await A.from("rooms").select("status, result").eq("id", room.id).single();
check("sala vira finished/won", after.data?.status === "finished" && after.data?.result === "won", JSON.stringify(after.data));
check("não marca depois do fim", errOf(await B.rpc("mark_cell", { p_room: room.id, p_idx: 4 })).includes("room_not_running"));

// --- permissões
check("escrita direta em marks é negada", !!(await C.from("marks").insert({ room_id: room.id, cell_idx: 5, user_id: (await C.auth.getUser()).data.user.id })).error);
check("events não é legível pelo cliente", !!(await A.from("events").select("id")).error);
check("anon sem sessão não cria sala", !!(await anon.rpc("create_room", {})).error);
check("ping funciona para o keepalive", !(await anon.rpc("ping")).error);
check("server_time funciona", !(await A.rpc("server_time")).error);

// --- encerrar partida (migration 0006)
const r2 = (await A.rpc("create_room", { p_size: 3, p_duration_s: 300, p_target_lines: 2, p_clip_policy: "off" })).data;
await B.rpc("join_room", { p_code: r2.code });
check("end_room: não dá para encerrar no lobby", errOf(await A.rpc("end_room", { p_room: r2.id })).includes("room_not_running"));
await A.rpc("start_room", { p_room: r2.id });
check("end_room: não anfitrião é recusado", errOf(await B.rpc("end_room", { p_room: r2.id })).includes("not_host"));
const ended = await A.rpc("end_room", { p_room: r2.id });
check("end_room: anfitrião encerra", ended.data?.status === "finished" && ended.data?.result === "ended", errOf(ended));
check("end_room: não marca depois de encerrada", errOf(await B.rpc("mark_cell", { p_room: r2.id, p_idx: 0 })).includes("room_not_running"));

// --- sorteio: só genéricos por padrão; com jogos escolhidos entram os específicos
const r3 = (await A.rpc("create_room", { p_size: 5, p_duration_s: 300, p_target_lines: 2, p_clip_policy: "off" })).data;
await A.rpc("start_room", { p_room: r3.id });
const generic = await A.from("cells").select("game_slug").eq("room_id", r3.id);
check("sorteio padrão: 25 casas, todas genéricas", generic.data?.length === 25 && generic.data.every((c) => c.game_slug === null), JSON.stringify(generic.data?.filter((c) => c.game_slug).slice(0, 3)));
const r4 = (await A.rpc("create_room", { p_size: 5, p_duration_s: 300, p_target_lines: 2, p_clip_policy: "off" })).data;
await A.rpc("start_room", { p_room: r4.id, p_custom_goals: ["Meu objetivo próprio"], p_game_slugs: ["minecraft", "elden-ring", "cs2"] });
const mixed = await A.from("cells").select("goal_text, game_slug").eq("room_id", r4.id);
const slugs = new Set((mixed.data ?? []).map((c) => c.game_slug).filter(Boolean));
check("com jogos escolhidos: só os escolhidos aparecem", [...slugs].every((s) => ["minecraft", "elden-ring", "cs2"].includes(s)), [...slugs].join(","));
check("objetivo próprio do anfitrião entra no tabuleiro", mixed.data?.some((c) => c.goal_text === "Meu objetivo próprio") === true);
await A.rpc("end_room", { p_room: r3.id });
await A.rpc("end_room", { p_room: r4.id });

console.log(failed === 0 ? "\nTudo certo." : `\n${failed} falha(s).`);
process.exit(failed === 0 ? 0 : 1);
