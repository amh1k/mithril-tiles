import { z } from "zod";

export const drawStrokeSchema = z.object({
  brush_size: z.number().positive(),
  color: z.string().min(1),
  from: z.string().optional(),
  from_x: z.number().min(0).max(1),
  from_y: z.number().min(0).max(1),
  room_code: z.string().optional(),
  to_x: z.number().min(0).max(1),
  to_y: z.number().min(0).max(1),
});

const drawStrokeEnvelopeSchema = z.object({
  type: z.literal("draw_stroke"),
  data: drawStrokeSchema,
});

export const roomSnapshotSchema = z.object({
  version: z.literal(1),
  room_code: z.string().min(1),
  game_state: z.enum([
    "idle",
    "starting",
    "started",
    "ending",
    "completed",
    "end_failed",
  ]),
  round_state: z.enum(["idle", "started"]),
  host_id: z.uuid(),
  players: z.array(
    z.object({
      id: z.uuid(),
      type: z.enum(["user", "guest", "bot"]),
      display_name: z.string().min(1),
      avatar_url: z.string().nullable().optional(),
      score: z.number().int(),
      is_connected: z.boolean(),
    }),
  ),
  game: z
    .object({
      id: z.uuid(),
      word_pack_id: z.uuid(),
      round_number: z.number().int().nonnegative(),
      total_rounds: z.number().int().positive(),
      drawer_id: z.uuid(),
      round_started_at: z.iso.datetime({ offset: true }),
      round_ends_at: z.iso.datetime({ offset: true }),
    })
    .nullable(),
  canvas: z.object({
    revision: z.number().int().nonnegative(),
  }),
  server_time: z.iso.datetime({ offset: true }),
});

const roomSnapshotEnvelopeSchema = z.object({
  type: z.literal("room_snapshot"),
  data: roomSnapshotSchema,
});

export const drawerWordSchema = z.object({
  word: z.string().min(1),
  round_number: z.number().int().positive(),
});

const drawerWordEnvelopeSchema = z.object({
  type: z.literal("drawer_word"),
  data: drawerWordSchema,
});

export const guesserWordSchema = z.object({
  word: z.string().min(1),
  round_number: z.number().int().positive(),
});

const guesserWordEnvelopeSchema = z.object({
  type: z.literal("guesser_word"),
  data: guesserWordSchema,
});

export const guessResultSchema = z.object({
  participant_id: z.uuid(),
  display_name: z.string().min(1),
  correct: z.literal(true),
  points_awarded: z.number().int().positive(),
});

const guessResultEnvelopeSchema = z.object({
  type: z.literal("guess_result"),
  data: guessResultSchema,
});

export type DrawStroke = z.infer<typeof drawStrokeSchema>;
export type DrawerWord = z.infer<typeof drawerWordSchema>;
export type GuesserWord = z.infer<typeof guesserWordSchema>;
export type GuessResult = z.infer<typeof guessResultSchema>;
export type RealtimeRoomSnapshot = z.infer<typeof roomSnapshotSchema>;

export type RoomSocketEvent =
  | {
      stroke: DrawStroke;
      type: "draw_stroke";
    }
  | {
      snapshot: RealtimeRoomSnapshot;
      type: "room_snapshot";
    }
  | {
      drawerWord: DrawerWord;
      type: "drawer_word";
    }
  | {
      guesserWord: GuesserWord;
      type: "guesser_word";
    }
  | {
      guessResult: GuessResult;
      type: "guess_result";
    }
  | {
      text: string;
      type: "game_ended";
    }
  | {
      type: "legacy_text";
      text: string;
    }
  | {
      type: "protocol_error";
      reason: string;
    };

export function parseRoomSocketMessage(data: unknown): RoomSocketEvent {
  if (typeof data !== "string") {
    return {
      type: "protocol_error",
      reason: "Only text WebSocket messages are supported by chat.",
    };
  }
  if (looksLikeJson(data)) {
    const parsedJson = safeParseJson(data);

    if (!parsedJson.ok) {
      return {
        type: "protocol_error",
        reason: "Structured WebSocket event is invalid JSON.",
      };
    }

    const drawStrokeEnvelope = drawStrokeEnvelopeSchema.safeParse(
      parsedJson.value,
    );

    if (drawStrokeEnvelope.success) {
      return {
        stroke: drawStrokeEnvelope.data.data,
        type: "draw_stroke",
      };
    }

    const roomSnapshotEnvelope = roomSnapshotEnvelopeSchema.safeParse(
      parsedJson.value,
    );

    if (roomSnapshotEnvelope.success) {
      return {
        snapshot: roomSnapshotEnvelope.data.data,
        type: "room_snapshot",
      };
    }

    const drawerWordEnvelope = drawerWordEnvelopeSchema.safeParse(
      parsedJson.value,
    );

    if (drawerWordEnvelope.success) {
      return {
        drawerWord: drawerWordEnvelope.data.data,
        type: "drawer_word",
      };
    }

    const guesserWordEnvelope = guesserWordEnvelopeSchema.safeParse(
      parsedJson.value,
    );

    if (guesserWordEnvelope.success) {
      return {
        guesserWord: guesserWordEnvelope.data.data,
        type: "guesser_word",
      };
    }

    const guessResultEnvelope = guessResultEnvelopeSchema.safeParse(
      parsedJson.value,
    );

    if (guessResultEnvelope.success) {
      return {
        guessResult: guessResultEnvelope.data.data,
        type: "guess_result",
      };
    }

    return {
      type: "protocol_error",
      reason: "Unsupported structured WebSocket event.",
    };
  }

  if (data.trim() === "Game has ended") {
    return {
      text: data,
      type: "game_ended",
    };
  }

  return {
    type: "legacy_text",
    text: data,
  };
}

function looksLikeJson(data: string): boolean {
  const trimmed = data.trimStart();
  return trimmed.startsWith("{");
}

function safeParseJson(data: string):
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
    } {
  try {
    return {
      ok: true,
      value: JSON.parse(data),
    };
  } catch {
    return {
      ok: false,
    };
  }
}
