/** 32 símbolos, sem 0/O/1/I: 32^6 ≈ 1,07 bilhão de combinações. Igual ao gerador do banco. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

const CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCode(input: string): boolean {
  return CODE_RE.test(normalizeRoomCode(input));
}

/**
 * Extrai o código de um link de convite: https://host/j/K7QF2M ou binguey://j/K7QF2M.
 * Também aceita o código puro. Devolve null se não for válido.
 */
export function parseInvite(input: string): string | null {
  const raw = input.trim();
  const fromLink = /^(?:https?:\/\/[^/]+\/|binguey:\/\/)j\/([^/?#]+)/i.exec(raw);
  const code = normalizeRoomCode(fromLink?.[1] ?? raw);
  return CODE_RE.test(code) ? code : null;
}

export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/j/${normalizeRoomCode(code)}`;
}
