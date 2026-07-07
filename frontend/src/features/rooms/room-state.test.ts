import { describe, expect, it } from "vitest";

import type { Principal } from "@/features/auth/schemas";
import { createPlaceholderRoomSnapshot } from "@/features/rooms/room-state";

describe("createPlaceholderRoomSnapshot", () => {
  it("creates a lobby snapshot from the current principal", () => {
    const principal: Principal = {
      type: "guest",
      id: "550e8400-e29b-41d4-a716-446655440000",
      display_name: "Player One",
    };

    expect(createPlaceholderRoomSnapshot(principal)).toEqual({
      canStartGame: false,
      drawerName: null,
      modeLabel: "Free draw",
      phase: "lobby",
      players: [
        {
          displayName: "Player One",
          id: "550e8400-e29b-41d4-a716-446655440000",
          isDrawer: false,
          isHost: false,
          principalType: "guest",
          score: 0,
        },
      ],
      roundLabel: "Lobby",
    });
  });
});
