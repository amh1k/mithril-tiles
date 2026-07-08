import type { Principal } from "@/features/auth/schemas";
import type { StartGameResponse } from "@/features/rooms/start-game";

export type RoomPhase = "lobby" | "active_round" | "round_cooldown" | "ended";

export type RoomPlayer = {
  displayName: string;
  id: string;
  isDrawer: boolean;
  isHost: boolean;
  principalType: Principal["type"];
  score: number;
};

export type RoomSnapshot = {
  canStartGame: boolean;
  drawerName: string | null;
  gameId?: string | null;
  modeLabel: string;
  phase: RoomPhase;
  players: RoomPlayer[];
  roundLabel: string;
};

export function createPlaceholderRoomSnapshot(
  principal: Principal,
): RoomSnapshot {
  return {
    canStartGame: false,
    drawerName: null,
    gameId: null,
    modeLabel: "Free draw",
    phase: "lobby",
    players: [
      {
        displayName: principal.display_name,
        id: principal.id,
        isDrawer: false,
        isHost: true,
        principalType: principal.type,
        score: 0,
      },
    ],
    roundLabel: "Lobby",
  };
}

export function startGameResponseToRoomSnapshot(
  response: StartGameResponse,
): RoomSnapshot {
  const drawer = response.game_participants.find(
    (participant) => participant.id === response.round.drawer_participant_id,
  );

  return {
    canStartGame: false,
    drawerName: drawer?.display_name_snapshot ?? null,
    gameId: response.game.id,
    modeLabel: "Drawing",
    phase: "active_round",
    players: response.game_participants.map((participant) => ({
      displayName: participant.display_name_snapshot,
      id: participant.id,
      isDrawer: participant.id === response.round.drawer_participant_id,
      isHost: participant.is_host,
      principalType:
        participant.participant_type === "user" ? "user" : "guest",
      score: 0,
    })),
    roundLabel: `Round ${response.round.round_number}`,
  };
}
