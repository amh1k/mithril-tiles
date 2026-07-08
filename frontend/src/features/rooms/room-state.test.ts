import { describe, expect, it } from "vitest";

import type { Principal } from "@/features/auth/schemas";
import {
  createPlaceholderRoomSnapshot,
  startGameResponseToRoomSnapshot,
} from "@/features/rooms/room-state";

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
      gameId: null,
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

describe("startGameResponseToRoomSnapshot", () => {
  it("maps a started game response into active room state", () => {
    expect(
      startGameResponseToRoomSnapshot({
        game: {
          id: "550e8400-e29b-41d4-a716-446655440010",
          room_code: "ROOM01",
          host_participant_id: "550e8400-e29b-41d4-a716-446655440011",
          word_pack_id: "550e8400-e29b-41d4-a716-446655440001",
          status: "started",
          settings_snapshot: {},
          started_at: "2026-07-07T00:00:00Z",
          ended_at: null,
        },
        game_participants: [
          {
            id: "550e8400-e29b-41d4-a716-446655440011",
            game_id: "550e8400-e29b-41d4-a716-446655440010",
            guest_session_id: "550e8400-e29b-41d4-a716-446655440000",
            display_name_snapshot: "Player One",
            participant_type: "guest",
            is_host: true,
            joined_at: "2026-07-07T00:00:00Z",
            left_at: null,
          },
          {
            id: "550e8400-e29b-41d4-a716-446655440012",
            game_id: "550e8400-e29b-41d4-a716-446655440010",
            guest_session_id: "550e8400-e29b-41d4-a716-446655440002",
            display_name_snapshot: "Player Two",
            participant_type: "guest",
            is_host: false,
            joined_at: "2026-07-07T00:00:00Z",
            left_at: null,
          },
        ],
        round: {
          id: "550e8400-e29b-41d4-a716-446655440013",
          game_id: "550e8400-e29b-41d4-a716-446655440010",
          round_number: 1,
          drawer_participant_id: "550e8400-e29b-41d4-a716-446655440012",
          word_id: "550e8400-e29b-41d4-a716-446655440014",
          word_text_snapshot: "castle",
          status: "started",
          duration_seconds: 60,
          started_at: "2026-07-07T00:00:00Z",
          ended_at: null,
        },
      }),
    ).toEqual({
      canStartGame: false,
      drawerName: "Player Two",
      gameId: "550e8400-e29b-41d4-a716-446655440010",
      modeLabel: "Drawing",
      phase: "active_round",
      players: [
        {
          displayName: "Player One",
          id: "550e8400-e29b-41d4-a716-446655440011",
          isDrawer: false,
          isHost: true,
          principalType: "guest",
          score: 0,
        },
        {
          displayName: "Player Two",
          id: "550e8400-e29b-41d4-a716-446655440012",
          isDrawer: true,
          isHost: false,
          principalType: "guest",
          score: 0,
        },
      ],
      roundLabel: "Round 1",
    });
  });
});
