import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RPC_ERRORS, type Clip, type ClipPolicy, type Mark, type Room, type RpcError } from "./types";

export type BingueyClient = SupabaseClient;

export function createBingueyClient(url: string, anonKey: string): BingueyClient {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 5 } }, // folga no limite gratuito de 100 msg/s
  });
}

export class BingueyError extends Error {
  constructor(
    readonly code: RpcError | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "BingueyError";
  }
}

function toError(message: string): BingueyError {
  const code = RPC_ERRORS.find((e) => message.includes(e)) ?? "unknown";
  return new BingueyError(code, message);
}

async function rpc<T>(c: BingueyClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw toError(error.message);
  return data as T;
}

/** Login anônimo + apelido: é o que acontece no toque em "Entrar". */
export async function ensureSession(c: BingueyClient): Promise<string> {
  const { data } = await c.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await c.auth.signInAnonymously();
  if (error || !anon.user) throw toError(error?.message ?? "not_authenticated");
  return anon.user.id;
}

export const api = {
  setNickname: (c: BingueyClient, nickname: string) => rpc(c, "upsert_profile", { p_nickname: nickname }),
  createRoom: (
    c: BingueyClient,
    o: { size?: 3 | 4 | 5; durationS?: number; targetLines?: number; clipPolicy?: ClipPolicy } = {},
  ) =>
    rpc<Room>(c, "create_room", {
      p_size: o.size ?? 4,
      p_duration_s: o.durationS ?? 3600,
      p_target_lines: o.targetLines ?? 2,
      p_clip_policy: o.clipPolicy ?? "optional",
    }),
  joinRoom: (c: BingueyClient, code: string) => rpc<Room>(c, "join_room", { p_code: code }),
  startRoom: (c: BingueyClient, room: string, customGoals: string[] = [], gameSlugs: string[] | null = null) =>
    rpc<Room>(c, "start_room", { p_room: room, p_custom_goals: customGoals, p_game_slugs: gameSlugs }),
  markCell: (c: BingueyClient, room: string, idx: number) => rpc<Mark>(c, "mark_cell", { p_room: room, p_idx: idx }),
  closeIfTimeout: (c: BingueyClient, room: string) => rpc<Room>(c, "close_if_timeout", { p_room: room }),
  attachClip: (
    c: BingueyClient,
    a: { markId: string; storagePath: string; bytes: number; durationMs: number; thumbPath?: string },
  ) =>
    rpc<Clip>(c, "attach_clip", {
      p_mark: a.markId,
      p_storage_path: a.storagePath,
      p_bytes: a.bytes,
      p_duration_ms: a.durationMs,
      p_thumb_path: a.thumbPath ?? null,
    }),
  setClipsActive: (c: BingueyClient, room: string, active: boolean) =>
    rpc<void>(c, "set_clips_active", { p_room: room, p_active: active }),
  /** Apaga a linha do clip e devolve o caminho do objeto, que o chamador remove do Storage. */
  deleteMyClip: (c: BingueyClient, clip: string) => rpc<string>(c, "delete_my_clip", { p_clip: clip }),
  serverTime: (c: BingueyClient) => rpc<string>(c, "server_time"),
};
