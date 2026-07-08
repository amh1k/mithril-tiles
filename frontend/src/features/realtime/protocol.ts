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

export type DrawStroke = z.infer<typeof drawStrokeSchema>;

export type RoomSocketEvent =
  | {
      stroke: DrawStroke;
      type: "draw_stroke";
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
