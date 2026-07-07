import { create } from "zustand";

import type { RoomSnapshot } from "@/features/rooms/room-state";

type RoomStoreState = {
  resetRoom: () => void;
  setSnapshot: (snapshot: RoomSnapshot) => void;
  snapshot: RoomSnapshot | null;
};

export const useRoomStore = create<RoomStoreState>((set) => ({
  resetRoom: () => set({ snapshot: null }),
  setSnapshot: (snapshot) => set({ snapshot }),
  snapshot: null,
}));
