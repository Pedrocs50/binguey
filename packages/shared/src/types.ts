import type { BoardSize } from "./board";

export type RoomStatus = "lobby" | "running" | "finished" | "expired";
export type ClipPolicy = "off" | "optional" | "required";
export type RoomResult = "won" | "timeout";
export type GoalKind = "boss" | "collect" | "npc" | "explore" | "combat" | "misc";

export interface Room {
  id: string;
  code: string;
  host_id: string;
  size: BoardSize;
  status: RoomStatus;
  result: RoomResult | null;
  seed: number;
  duration_s: number;
  target_lines: number;
  clip_policy: ClipPolicy;
  started_at: string | null;
  ends_at: string | null;
  finished_at: string | null;
  expires_at: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  clips_active: boolean;
}

export interface Cell {
  room_id: string;
  idx: number;
  goal_text: string;
  game_slug: string | null;
  kind: GoalKind | null;
}

export interface Mark {
  id: string;
  room_id: string;
  cell_idx: number;
  user_id: string;
  marked_at: string;
}

export interface Clip {
  id: string;
  mark_id: string;
  room_id: string;
  user_id: string;
  storage_path: string;
  bytes: number | null;
  duration_ms: number | null;
  thumb_path: string | null;
  expires_at: string;
}

/** Mensagens de erro levantadas pelas RPCs (raise exception '...'). */
export const RPC_ERRORS = [
  "not_authenticated",
  "profile_required",
  "not_member",
  "not_host",
  "room_not_found",
  "room_closed",
  "room_not_running",
  "already_started",
  "already_marked",
  "invalid_cell",
  "invalid_size",
  "invalid_duration",
  "invalid_target_lines",
  "invalid_clip_policy",
  "invalid_path",
  "not_enough_goals",
  "too_many_rooms",
  "rate_limited",
  "mark_not_found",
  "clips_disabled",
  "clip_limit",
  "clip_not_found",
] as const;

export type RpcError = (typeof RPC_ERRORS)[number];
