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
