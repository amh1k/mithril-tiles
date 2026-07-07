import type { Principal } from "@/features/auth/schemas";

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
    modeLabel: "Free draw",
    phase: "lobby",
    players: [
      {
        displayName: principal.display_name,
        id: principal.id,
        isDrawer: false,
        isHost: false,
        principalType: principal.type,
        score: 0,
      },
    ],
    roundLabel: "Lobby",
  };
}
