import { describe, expect, it } from "vitest";

import {
  generateRoomCode,
  normalizeRoomCode,
  roomCodeInputSchema,
} from "./room-code";

describe("room codes", () => {
  it("normalizes case, whitespace, and separators", () => {
    expect(normalizeRoomCode(" room-01 ")).toBe("ROOM01");
    expect(roomCodeInputSchema.parse(" room-01 ")).toBe("ROOM01");
  });

  it.each(["ABC", "ROOM@1", "ABCDEFGHIJKLM"])(
    "rejects invalid room code %s",
    (roomCode) => {
      expect(roomCodeInputSchema.safeParse(roomCode).success).toBe(false);
    },
  );

  it("accepts existing alphanumeric backend room codes", () => {
    expect(roomCodeInputSchema.parse("1234")).toBe("1234");
    expect(roomCodeInputSchema.parse("ROOM01")).toBe("ROOM01");
  });

  it("generates six-character codes without ambiguous characters", () => {
    for (let index = 0; index < 50; index += 1) {
      const roomCode = generateRoomCode();

      expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(roomCodeInputSchema.parse(roomCode)).toBe(roomCode);
    }
  });
});
