import { z } from "zod";

const GENERATED_ROOM_CODE_LENGTH = 6;
const GENERATED_ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const canonicalRoomCodeSchema = z
  .string()
  .min(4, "Room code must contain at least 4 characters")
  .max(12, "Room code must not exceed 12 characters")
  .regex(/^[A-Z0-9]+$/, "Room code may contain only letters and numbers");

export const roomCodeInputSchema = z
  .string()
  .transform(normalizeRoomCode)
  .pipe(canonicalRoomCodeSchema)
  .brand<"RoomCode">();

export const joinRoomFormSchema = z.object({
  room_code: roomCodeInputSchema,
});

export type RoomCode = z.infer<typeof roomCodeInputSchema>;
export type JoinRoomFormInput = z.input<typeof joinRoomFormSchema>;
export type JoinRoomFormValues = z.output<typeof joinRoomFormSchema>;

export function normalizeRoomCode(value: string): string {
  return value
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();
}

export function generateRoomCode(
  randomSource: Crypto = globalThis.crypto,
): RoomCode {
  const randomBytes = new Uint8Array(GENERATED_ROOM_CODE_LENGTH);
  randomSource.getRandomValues(randomBytes);
  const code = Array.from(
    randomBytes,
    (byte) =>
      GENERATED_ROOM_CODE_ALPHABET[byte % GENERATED_ROOM_CODE_ALPHABET.length],
  ).join("");

  return roomCodeInputSchema.parse(code);
}
