import { api, ensureSession, type ClipPolicy, type Room } from "@binguey/shared";
import { supabase } from "./supabase";
import { rememberRoom, setNickname } from "./storage";

export function validateNickname(raw: string): string | null {
  const n = raw.trim();
  if (n.length < 2 || n.length > 24) return "O apelido precisa ter de 2 a 24 caracteres.";
  return null;
}

async function identify(nickname: string) {
  await ensureSession(supabase); // login anônimo, sem e-mail nem senha
  await api.setNickname(supabase, nickname.trim());
  setNickname(nickname.trim());
}

export async function createRoomAs(
  nickname: string,
  opts: { size: 3 | 4 | 5; durationS: number; targetLines: number; clipPolicy: ClipPolicy },
): Promise<Room> {
  await identify(nickname);
  const room = await api.createRoom(supabase, opts);
  rememberRoom(room.code);
  return room;
}

export async function joinRoomAs(nickname: string, code: string): Promise<Room> {
  await identify(nickname);
  const room = await api.joinRoom(supabase, code);
  rememberRoom(room.code);
  return room;
}
