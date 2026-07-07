export type RoomSocketEvent =
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
    return {
      type: "protocol_error",
      reason: "Structured WebSocket events are not handled by chat yet.",
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
