import { describe, expect, it } from "vitest";
import { ROOM_CODE_ALPHABET, inviteUrl, isValidRoomCode, normalizeRoomCode, parseInvite } from "./roomCode";

describe("roomCode", () => {
  it("alfabeto tem 32 símbolos e não tem 0/O/1/I", () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OI]/);
  });

  it("normaliza e valida", () => {
    expect(normalizeRoomCode(" k7qf2m ")).toBe("K7QF2M");
    expect(isValidRoomCode("k7qf2m")).toBe(true);
    expect(isValidRoomCode("K7QF2")).toBe(false);
    expect(isValidRoomCode("K7QF20")).toBe(false); // 0 não existe
  });

  it("extrai o código de links web e de deep link", () => {
    expect(parseInvite("https://binguey.pages.dev/j/K7QF2M")).toBe("K7QF2M");
    expect(parseInvite("binguey://j/k7qf2m")).toBe("K7QF2M");
    expect(parseInvite("K7QF2M")).toBe("K7QF2M");
    expect(parseInvite("https://exemplo.com/j/XXXX")).toBeNull();
    expect(parseInvite("javascript:alert(1)")).toBeNull();
  });

  it("monta o link de convite", () => {
    expect(inviteUrl("https://binguey.pages.dev/", "k7qf2m")).toBe("https://binguey.pages.dev/j/K7QF2M");
  });
});
