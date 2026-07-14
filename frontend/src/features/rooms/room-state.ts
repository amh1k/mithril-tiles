import type { Principal } from "@/features/auth/schemas";
import type { RealtimeRoomSnapshot } from "@/features/realtime/protocol";
import type { StartGameResponse } from "@/features/rooms/start-game";

export type RoomPhase = "lobby" | "active_round" | "round_cooldown" | "ended";

export type RoomPlayer = {
  displayName: string;
  id: string;
  isDrawer: boolean;
  isHost: boolean;
  principalType: "user" | "guest" | "bot";
  score: number;
};

export type RoomSnapshot = {
  canStartGame: boolean;
  drawerName: string | null;
  gameId?: string | null;
  modeLabel: string;
  phase: RoomPhase;
  players: RoomPlayer[];
  roundEndsAt: string | null;
  roundLabel: string;
  roundStartedAt: string | null;
  serverTime: string | null;
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
    roundEndsAt: null,
    roundLabel: "Lobby",
    roundStartedAt: null,
    serverTime: null,
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
      principalType: roomPlayerType(participant.participant_type),
      score: 0,
    })),
    roundEndsAt: addSecondsToIsoDate(
      response.round.started_at,
      response.round.duration_seconds,
    ),
    roundLabel: `Round ${response.round.round_number}`,
    roundStartedAt: response.round.started_at,
    serverTime: null,
  };
}

function roomPlayerType(type: string | undefined): RoomPlayer["principalType"] {
  if (type === "user" || type === "guest" || type === "bot") {
    return type;
  }
  return "guest";
}

export function realtimeSnapshotToRoomSnapshot(
  snapshot: RealtimeRoomSnapshot,
  currentPrincipalId: string,
): RoomSnapshot {
  const phase = roomPhaseFromRealtimeSnapshot(snapshot);
  const drawerId = snapshot.game?.drawer_id ?? null;
  const drawer = snapshot.players.find((player) => player.id === drawerId);

  return {
    canStartGame:
      snapshot.game_state === "idle" &&
      snapshot.host_id === currentPrincipalId &&
      snapshot.players.length >= 2,
    drawerName: drawer?.display_name ?? null,
    gameId: snapshot.game?.id ?? null,
    modeLabel:
      phase === "active_round"
        ? "Drawing"
        : phase === "round_cooldown"
          ? "Round break"
          : phase === "ended"
            ? "Game over"
            : "Lobby",
    phase,
    players: snapshot.players.map((player) => ({
      displayName: player.display_name,
      id: player.id,
      isDrawer: player.id === drawerId,
      isHost: player.id === snapshot.host_id,
      principalType: player.type,
      score: player.score,
    })),
    roundEndsAt: snapshot.game?.round_ends_at ?? null,
    roundLabel:
      snapshot.game === null
        ? "Lobby"
        : `Round ${snapshot.game.round_number} of ${snapshot.game.total_rounds}`,
    roundStartedAt: snapshot.game?.round_started_at ?? null,
    serverTime: snapshot.server_time,
  };
}

function addSecondsToIsoDate(date: string, seconds: number): string {
  return new Date(Date.parse(date) + seconds * 1000).toISOString();
}

function roomPhaseFromRealtimeSnapshot(
  snapshot: RealtimeRoomSnapshot,
): RoomPhase {
  if (
    snapshot.game_state === "ending" ||
    snapshot.game_state === "completed" ||
    snapshot.game_state === "end_failed"
  ) {
    return "ended";
  }
  if (
    snapshot.game_state === "started" &&
    snapshot.round_state === "started"
  ) {
    return "active_round";
  }
  if (snapshot.game_state === "started") {
    return "round_cooldown";
  }
  return "lobby";
}
