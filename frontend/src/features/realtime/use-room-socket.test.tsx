import {
  act,
  renderHook,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { DrawStroke } from "@/features/realtime/protocol";
import {
  createDrawStrokeMessage,
  useRoomSocket,
} from "@/features/realtime/use-room-socket";
import type { RoomCode } from "@/features/rooms/room-code";

vi.mock("@/lib/env/client", () => ({
  clientEnv: {
    NEXT_PUBLIC_BACKEND_WS_URL: "ws://localhost:4000",
  },
}));

const stroke: DrawStroke = {
  brush_size: 0.01,
  color: "#111827",
  from_x: 0,
  from_y: 0,
  to_x: 1,
  to_y: 1,
};

class MockWebSocket {
  static OPEN = 1;

  readyState = MockWebSocket.OPEN;
  sentMessages: string[] = [];
  private listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  static instances: MockWebSocket[] = [];

  addEventListener(event: string, listener: (event: unknown) => void) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }

  send(message: string) {
    this.sentMessages.push(message);
  }

  emit(event: string, payload: unknown = {}) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }
}

describe("useRoomSocket drawing support", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            websocket_ticket: {
              ticket: "ticket-123",
              room_code: "ROOM01",
              expires_at: "2026-07-07T10:00:30Z",
              created_at: "2026-07-07T10:00:00Z",
            },
          },
          {
            status: 201,
          },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates backend draw_stroke envelopes", () => {
    expect(JSON.parse(createDrawStrokeMessage(stroke))).toEqual({
      type: "draw_stroke",
      data: stroke,
    });
  });

  it("sends draw strokes over an open socket", async () => {
    const { result } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emit("open");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("connected");
    });

    expect(result.current.sendDrawStroke(stroke)).toBe(true);
    expect(MockWebSocket.instances[0].sentMessages).toEqual([
      createDrawStrokeMessage(stroke),
    ]);
  });

  it("stores incoming draw strokes separately from chat messages", async () => {
    const { result } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emit("message", {
        data: createDrawStrokeMessage(stroke),
      });
    });

    await waitFor(() => {
      expect(result.current.drawStrokes).toEqual([
        {
          id: 1,
          stroke,
        },
      ]);
    });
    expect(result.current.messages).toEqual([]);
  });

  it("stores the latest authoritative room snapshot", async () => {
    const { result } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );
    const snapshot = {
      version: 1,
      room_code: "ROOM01",
      game_state: "idle",
      round_state: "idle",
      host_id: "550e8400-e29b-41d4-a716-446655440000",
      players: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "user",
          display_name: "Aragorn",
          score: 0,
          is_connected: true,
        },
      ],
      game: null,
      canvas: {
        revision: 0,
      },
      server_time: "2026-07-09T10:00:05Z",
    };

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emit("message", {
        data: JSON.stringify({
          type: "room_snapshot",
          data: snapshot,
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.roomSnapshot).toEqual(snapshot);
    });
  });

  it("stores the private drawer word", async () => {
    const { result } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emit("message", {
        data: JSON.stringify({
          type: "drawer_word",
          data: {
            word: "Gandalf",
            round_number: 1,
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.drawerWord).toEqual({
        word: "Gandalf",
        round_number: 1,
      });
    });
  });

  it("marks the game ended while preserving the announcement message", async () => {
    const { result } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emit("message", {
        data: "Game has ended",
      });
    });

    await waitFor(() => {
      expect(result.current.gameEndedAt).not.toBeNull();
    });
    expect(result.current.messages).toEqual([
      {
        id: 1,
        text: "Game has ended",
      },
    ]);
  });

  it("ignores events emitted by a stale socket after reconnecting", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { result } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const firstSocket = MockWebSocket.instances[0];

    act(() => {
      firstSocket.emit("close");
      vi.advanceTimersByTime(1_000);
    });

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    const currentSocket = MockWebSocket.instances[1];

    act(() => {
      currentSocket.emit("open");
      firstSocket.emit("message", {
        data: "Message from stale socket",
      });
      firstSocket.emit("close");
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.messages).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("resets the retry count after a replacement socket connects", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { result } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emit("close");
      vi.advanceTimersByTime(1_000);
    });

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    act(() => {
      MockWebSocket.instances[1].emit("open");
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.retryAttempt).toBe(0);
    expect(result.current.errorMessage).toBeUndefined();
  });

  it("does not reconnect after the hook unmounts", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { unmount } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emit("close");
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("pauses retries while offline and reconnects when online", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    let online = true;
    vi.spyOn(window.navigator, "onLine", "get").mockImplementation(
      () => online,
    );

    const { result } = renderHook(() =>
      useRoomSocket({ roomCode: "ROOM01" as RoomCode }),
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    online = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
      MockWebSocket.instances[0].emit("close");
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.status).toBe("reconnecting");
    expect(result.current.retryAttempt).toBe(0);
    expect(MockWebSocket.instances).toHaveLength(1);

    online = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
    });

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
