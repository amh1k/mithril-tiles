import { describe, expect, it } from "vitest";

import { parseRoomSocketMessage } from "@/features/realtime/protocol";

describe("parseRoomSocketMessage", () => {
  it("treats backend plain text messages as legacy chat text", () => {
    expect(parseRoomSocketMessage("[Alice]: hello\n")).toEqual({
      type: "legacy_text",
      text: "[Alice]: hello\n",
    });
  });

  it("treats join announcements as legacy chat text", () => {
    expect(
      parseRoomSocketMessage("*** Alice joined the room ***\n"),
    ).toEqual({
      type: "legacy_text",
      text: "*** Alice joined the room ***\n",
    });
  });

  it("parses backend game-ended announcements", () => {
    expect(parseRoomSocketMessage("Game has ended")).toEqual({
      text: "Game has ended",
      type: "game_ended",
    });
  });

  it("parses structured drawing events", () => {
    expect(
      parseRoomSocketMessage(
        JSON.stringify({
          type: "draw_stroke",
          data: {
            from_x: 0,
            from_y: 0,
            to_x: 1,
            to_y: 1,
            color: "#111827",
            brush_size: 0.01,
          },
        }),
      ),
    ).toEqual({
      stroke: {
        brush_size: 0.01,
        color: "#111827",
        from_x: 0,
        from_y: 0,
        to_x: 1,
        to_y: 1,
      },
      type: "draw_stroke",
    });
  });

  it("parses authoritative room snapshots", () => {
    const snapshot = {
      version: 1,
      room_code: "ABC123",
      game_state: "started",
      round_state: "started",
      host_id: "550e8400-e29b-41d4-a716-446655440000",
      players: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "user",
          display_name: "Aragorn",
          score: 1,
          is_connected: true,
        },
      ],
      game: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        word_pack_id: "550e8400-e29b-41d4-a716-446655440002",
        round_number: 1,
        total_rounds: 2,
        drawer_id: "550e8400-e29b-41d4-a716-446655440000",
        round_started_at: "2026-07-09T10:00:00Z",
        round_ends_at: "2026-07-09T10:00:20Z",
      },
      canvas: {
        revision: 0,
      },
      server_time: "2026-07-09T10:00:05Z",
    };

    expect(
      parseRoomSocketMessage(
        JSON.stringify({
          type: "room_snapshot",
          data: snapshot,
        }),
      ),
    ).toEqual({
      snapshot,
      type: "room_snapshot",
    });
  });

  it("rejects invalid structured drawing events", () => {
    expect(
      parseRoomSocketMessage(
        JSON.stringify({
          type: "draw_stroke",
          data: {
            from_x: -1,
            from_y: 0,
            to_x: 1,
            to_y: 1,
            color: "#111827",
            brush_size: 0.01,
          },
        }),
      ),
    ).toEqual({
      type: "protocol_error",
      reason: "Unsupported structured WebSocket event.",
    });
  });

  it("rejects unsupported structured events", () => {
    expect(
      parseRoomSocketMessage(
        JSON.stringify({
          type: "unknown",
          data: {},
        }),
      ),
    ).toEqual({
      type: "protocol_error",
      reason: "Unsupported structured WebSocket event.",
    });
  });

  it("rejects malformed structured JSON", () => {
    expect(parseRoomSocketMessage("{")).toEqual({
      type: "protocol_error",
      reason: "Structured WebSocket event is invalid JSON.",
    });
  });

  it("rejects non-text websocket messages", () => {
    expect(parseRoomSocketMessage(new ArrayBuffer(1))).toEqual({
      type: "protocol_error",
      reason: "Only text WebSocket messages are supported by chat.",
    });
  });
});
