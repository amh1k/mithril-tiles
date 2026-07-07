import { describe, expect, it } from "vitest";

import { websocketTicketResponseSchema } from "@/features/rooms/tickets";

describe("websocketTicketResponseSchema", () => {
  it("accepts the backend websocket ticket envelope", () => {
    const parsed = websocketTicketResponseSchema.parse({
      websocket_ticket: {
        ticket: "single-use-ticket",
        room_code: "room-01",
        expires_at: "2026-07-07T10:00:30Z",
        created_at: "2026-07-07T10:00:00Z",
      },
    });

    expect(parsed.websocket_ticket).toEqual({
      ticket: "single-use-ticket",
      room_code: "ROOM01",
      expires_at: "2026-07-07T10:00:30Z",
      created_at: "2026-07-07T10:00:00Z",
    });
  });

  it("rejects missing or empty ticket values", () => {
    const result = websocketTicketResponseSchema.safeParse({
      websocket_ticket: {
        ticket: "",
        room_code: "ROOM01",
        expires_at: "2026-07-07T10:00:30Z",
        created_at: "2026-07-07T10:00:00Z",
      },
    });

    expect(result.success).toBe(false);
  });
});
