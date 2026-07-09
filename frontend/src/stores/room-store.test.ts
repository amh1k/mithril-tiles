import { afterEach, describe, expect, it } from "vitest";

import type { RoomSnapshot } from "@/features/rooms/room-state";
import { useRoomStore } from "@/stores/room-store";

const snapshot: RoomSnapshot = {
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
  roundEndsAt: null,
  roundLabel: "Lobby",
  roundStartedAt: null,
  serverTime: null,
};

describe("useRoomStore", () => {
  afterEach(() => {
    useRoomStore.getState().resetRoom();
  });

  it("stores the current room snapshot", () => {
    useRoomStore.getState().setSnapshot(snapshot);

    expect(useRoomStore.getState().snapshot).toEqual(snapshot);
  });

  it("resets the current room snapshot", () => {
    useRoomStore.getState().setSnapshot(snapshot);
    useRoomStore.getState().resetRoom();

    expect(useRoomStore.getState().snapshot).toBeNull();
  });
});
