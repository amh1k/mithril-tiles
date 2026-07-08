import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Principal } from "@/features/auth/schemas";
import type { RoomSocketStatus } from "@/features/realtime/use-room-socket";
import type { RoomCode } from "@/features/rooms/room-code";
import { useRoomStore } from "@/stores/room-store";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import { RoomShell } from "./room-shell";

const useRoomSocketMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const drawingCanvasMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/realtime/use-room-socket", () => ({
  useRoomSocket: useRoomSocketMock,
}));

vi.mock("@/features/drawing/drawing-canvas", () => ({
  DrawingCanvas: drawingCanvasMock,
}));

vi.stubGlobal("fetch", fetchMock);

const principal: Principal = {
  type: "guest",
  id: "550e8400-e29b-41d4-a716-446655440000",
  display_name: "Player One",
};

function renderRoomShell({
  drawStrokes = [],
  errorMessage,
  finalScoresResponse,
  gameEndedAt = null,
  messages = [],
  sendChatMessage = vi.fn(),
  sendDrawStroke = vi.fn(),
  startGameResponse,
  status = "connected",
}: {
  drawStrokes?: Array<{
    id: number;
    stroke: {
      brush_size: number;
      color: string;
      from_x: number;
      from_y: number;
      to_x: number;
      to_y: number;
    };
  }>;
  errorMessage?: string;
  finalScoresResponse?: unknown;
  gameEndedAt?: number | null;
  messages?: Array<{ id: number; text: string }>;
  sendChatMessage?: ReturnType<typeof vi.fn>;
  sendDrawStroke?: ReturnType<typeof vi.fn>;
  startGameResponse?: unknown;
  status?: RoomSocketStatus;
} = {}) {
  if (finalScoresResponse !== undefined) {
    fetchMock.mockResolvedValueOnce(finalScoresResponse);
  }
  mockWordPacksResponse();
  if (startGameResponse !== undefined) {
    fetchMock.mockResolvedValueOnce(startGameResponse);
  }

  useRoomSocketMock.mockReturnValue({
    drawStrokes,
    errorMessage,
    gameEndedAt,
    messages,
    retryAttempt: 0,
    sendChatMessage,
    sendDrawStroke,
    status,
  });
  drawingCanvasMock.mockImplementation(() => (
    <div data-testid="drawing-canvas" />
  ));

  renderWithQueryClient(
    <RoomShell principal={principal} roomCode={"ROOM01" as RoomCode} />,
  );

  return {
    sendChatMessage,
    sendDrawStroke,
  };
}

describe("RoomShell", () => {
  afterEach(() => {
    vi.clearAllMocks();
    useRoomStore.getState().resetRoom();
  });

  it("renders room context and received chat messages", async () => {
    const user = userEvent.setup();
    renderRoomShell({
      messages: [
        {
          id: 1,
          text: "Welcome, Player One!\n",
        },
        {
          id: 2,
          text: "[Player Two]: hello\n",
        },
      ],
      status: "connected",
    });

    await lockDefaultWordPack(user);

    expect(screen.getByText("ROOM01")).toBeInTheDocument();
    expect(screen.getByText("Game lobby")).toBeInTheDocument();
    expect(screen.getAllByText("Connected")).not.toHaveLength(0);
    expect(
      screen.getByText("Welcome, Player One!"),
    ).toBeInTheDocument();
    expect(screen.getByText("[Player Two]: hello")).toBeInTheDocument();
  });

  it("copies the room code from the lobby header", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderRoomShell();

    await lockDefaultWordPack(user);
    await user.click(screen.getByRole("button", { name: "Copy code" }));

    expect(writeText).toHaveBeenCalledWith("ROOM01");
    expect(
      screen.getByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
  });

  it("keeps chat messages inside a scrollable panel", async () => {
    const user = userEvent.setup();
    renderRoomShell({
      messages: Array.from({ length: 40 }, (_, index) => ({
        id: index + 1,
        text: `message ${index + 1}`,
      })),
      status: "connected",
    });

    await lockDefaultWordPack(user);

    expect(screen.getByTestId("chat-message-list")).toHaveClass(
      "overflow-y-auto",
    );
    expect(screen.getByText("message 40")).toBeInTheDocument();
  });

  it("lets players choose a drawing color", async () => {
    const user = userEvent.setup();
    renderRoomShell();

    await lockDefaultWordPack(user);

    const black = screen.getByRole("radio", { name: "Black" });
    const red = screen.getByRole("radio", { name: "Red" });

    expect(black).toHaveAttribute("aria-checked", "true");

    await user.click(red);

    expect(red).toHaveAttribute("aria-checked", "true");
    expect(black).toHaveAttribute("aria-checked", "false");
  });

  it("lets players choose the eraser tool", async () => {
    const user = userEvent.setup();
    renderRoomShell();

    await lockDefaultWordPack(user);

    const black = screen.getByRole("radio", { name: "Black" });
    const eraser = screen.getByRole("radio", { name: "Eraser" });

    await user.click(eraser);

    expect(eraser).toHaveAttribute("aria-checked", "true");
    expect(black).toHaveAttribute("aria-checked", "false");
  });

  it("sends chat messages through the room socket", async () => {
    const user = userEvent.setup();
    const sendChatMessage = vi.fn(() => true);
    renderRoomShell({ sendChatMessage, status: "connected" });

    await lockDefaultWordPack(user);

    const input = screen.getByLabelText("Chat message");
    await user.type(input, "hello room");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(sendChatMessage).toHaveBeenCalledWith("hello room");
    expect(input).toHaveValue("");
  });

  it("keeps the drafted message when sending fails", async () => {
    const user = userEvent.setup();
    const sendChatMessage = vi.fn(() => false);
    renderRoomShell({ sendChatMessage, status: "connected" });

    await lockDefaultWordPack(user);

    const input = screen.getByLabelText("Chat message");
    await user.type(input, "still pending");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(sendChatMessage).toHaveBeenCalledWith("still pending");
    expect(input).toHaveValue("still pending");
  });

  it("disables chat while the socket is disconnected", async () => {
    const user = userEvent.setup();
    renderRoomShell({ status: "connecting" });

    await lockDefaultWordPack(user);

    expect(screen.getByLabelText("Chat message")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
  });

  it("shows socket failure messages", async () => {
    const user = userEvent.setup();
    renderRoomShell({
      errorMessage: "The realtime ticket request was rejected.",
      status: "failed",
    });

    await lockDefaultWordPack(user);

    expect(screen.getAllByText("Failed")).not.toHaveLength(0);
    expect(
      screen.getByText("The realtime ticket request was rejected."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Realtime connection unavailable"),
    ).toBeInTheDocument();
  });

  it("shows reconnect progress without enabling chat", async () => {
    const user = userEvent.setup();
    renderRoomShell({
      errorMessage: "The realtime connection closed unexpectedly.",
      status: "reconnecting",
    });

    await lockDefaultWordPack(user);

    expect(
      screen.getByText("Restoring realtime connection"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Chat message")).toBeDisabled();
  });

  it("shows ranked final scores and lets the player dismiss them", async () => {
    const user = userEvent.setup();
    useRoomStore.getState().setSnapshot({
      canStartGame: false,
      drawerName: null,
      gameId: "550e8400-e29b-41d4-a716-446655440010",
      modeLabel: "Drawing",
      phase: "ended",
      players: [
        {
          displayName: principal.display_name,
          id: principal.id,
          isDrawer: false,
          isHost: true,
          principalType: "guest",
          score: 120,
        },
      ],
      roundLabel: "Complete",
    });
    renderRoomShell({
      finalScoresResponse: {
        json: async () => ({
          game_final_scores: [
            {
              created_at: "2026-07-07T00:00:00Z",
              final_rank: 1,
              final_score: 120,
              game_id: "550e8400-e29b-41d4-a716-446655440010",
              id: "550e8400-e29b-41d4-a716-446655440021",
              is_winner: true,
              participant_id: "550e8400-e29b-41d4-a716-446655440011",
            },
            {
              created_at: "2026-07-07T00:00:00Z",
              final_rank: 2,
              final_score: 80,
              game_id: "550e8400-e29b-41d4-a716-446655440010",
              id: "550e8400-e29b-41d4-a716-446655440022",
              is_winner: false,
              participant_id: "550e8400-e29b-41d4-a716-446655440012",
            },
          ],
        }),
        ok: true,
      },
      gameEndedAt: Date.now(),
    });

    await lockDefaultWordPack(user);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Player 1 takes the crown.")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Close final scores" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads word packs for the room", async () => {
    renderRoomShell();

    expect(fetchMock).toHaveBeenCalledWith("/api/word-packs", {
      cache: "no-store",
      method: "GET",
      signal: expect.any(AbortSignal),
    });
    expect(await screen.findByText("Pick the theme for this room")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fantasy Pack/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not let non-host players select the word pack", async () => {
    useRoomStore.getState().setSnapshot({
      canStartGame: false,
      drawerName: null,
      gameId: null,
      modeLabel: "Free draw",
      phase: "lobby",
      players: [
        {
          displayName: "Player One",
          id: principal.id,
          isDrawer: false,
          isHost: false,
          principalType: "guest",
          score: 0,
        },
        {
          displayName: "Player Two",
          id: "550e8400-e29b-41d4-a716-446655440002",
          isDrawer: false,
          isHost: true,
          principalType: "guest",
          score: 0,
        },
      ],
      roundLabel: "Lobby",
    });

    renderRoomShell();

    expect(
      await screen.findByText("The host is choosing a word pack"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lock word pack" }),
    ).not.toBeInTheDocument();
  });

  it("starts the game with the selected word pack", async () => {
    const user = userEvent.setup();
    renderRoomShell({
      startGameResponse: {
        json: async () => validStartGameResponse(),
        ok: true,
      },
    });

    await lockDefaultWordPack(user);
    await user.click(screen.getByRole("button", { name: "Start game" }));

    expect(fetchMock).toHaveBeenLastCalledWith("/api/rooms/ROOM01/start", {
      body: JSON.stringify({
        word_pack_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(
      await screen.findByText("Game start request accepted."),
    ).toBeInTheDocument();
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getAllByText("Player Two")).not.toHaveLength(0);
    expect(
      screen.getByText("Current players and round scores."),
    ).toBeInTheDocument();
  });

  it("lets the host select a different word pack before starting", async () => {
    const user = userEvent.setup();
    renderRoomShell({
      startGameResponse: {
        json: async () => validStartGameResponse(),
        ok: true,
      },
    });

    await screen.findByText("Pick the theme for this room");
    await user.click(screen.getByRole("button", { name: /Animals Pack/ }));
    await user.click(screen.getByRole("button", { name: "Lock word pack" }));
    await user.click(screen.getByRole("button", { name: "Start game" }));

    expect(fetchMock).toHaveBeenLastCalledWith("/api/rooms/ROOM01/start", {
      body: JSON.stringify({
        word_pack_id: "550e8400-e29b-41d4-a716-446655440002",
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("keeps canvas strokes local for non-drawers after game start", async () => {
    const user = userEvent.setup();
    const sendDrawStroke = vi.fn();
    renderRoomShell({
      sendDrawStroke,
      startGameResponse: {
        json: async () => validStartGameResponse(),
        ok: true,
      },
    });

    expect(drawingCanvasMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        onStroke: undefined,
      }),
      undefined,
    );

    await lockDefaultWordPack(user);
    await user.click(screen.getByRole("button", { name: "Start game" }));
    await screen.findByText("Game start request accepted.");

    expect(drawingCanvasMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        disabled: true,
        onStroke: undefined,
      }),
      undefined,
    );
    expect(screen.getByText("Watching Player Two")).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Drawing tool" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Chat message")).toHaveAttribute(
      "placeholder",
      "Type /guess followed by your answer",
    );
  });

  it("connects canvas strokes to the room socket for the drawer", async () => {
    const user = userEvent.setup();
    const sendDrawStroke = vi.fn();
    renderRoomShell({
      sendDrawStroke,
      startGameResponse: {
        json: async () =>
          validStartGameResponse({
            drawerParticipantId: "550e8400-e29b-41d4-a716-446655440011",
          }),
        ok: true,
      },
    });

    expect(drawingCanvasMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        disabled: false,
        onStroke: undefined,
      }),
      undefined,
    );

    await lockDefaultWordPack(user);
    await user.click(screen.getByRole("button", { name: "Start game" }));
    await screen.findByText("Game start request accepted.");

    expect(drawingCanvasMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        disabled: false,
        onStroke: sendDrawStroke,
      }),
      undefined,
    );
    expect(screen.getByText("Your turn to draw")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Drawing tool" }),
    ).toBeInTheDocument();
  });

  it("keeps the game idle when an accepted start response is invalid", async () => {
    const user = userEvent.setup();
    renderRoomShell({
      startGameResponse: {
        json: async () => ({
          unexpected: true,
        }),
        ok: true,
      },
    });

    await lockDefaultWordPack(user);
    await user.click(screen.getByRole("button", { name: "Start game" }));

    expect(
      await screen.findByText(
        "Game start was accepted, but the response could not be fully understood.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start game" })).toBeEnabled();
  });

  it("keeps the game idle when start game is rejected", async () => {
    const user = userEvent.setup();
    renderRoomShell({
      startGameResponse: {
        json: async () => ({
          message: "game has already started",
        }),
        ok: false,
      },
    });

    await lockDefaultWordPack(user);
    await user.click(screen.getByRole("button", { name: "Start game" }));

    expect(
      await screen.findByText("game has already started"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start game" })).toBeEnabled();
  });
});

async function lockDefaultWordPack(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Pick the theme for this room");
  await user.click(screen.getByRole("button", { name: "Lock word pack" }));
}

function mockWordPacksResponse() {
  fetchMock.mockResolvedValueOnce({
    json: async () => ({
      word_packs: [
        {
          created_at: "2026-07-07T00:00:00Z",
          description: "Fantasy words",
          id: "550e8400-e29b-41d4-a716-446655440001",
          is_active: true,
          name: "Fantasy Pack",
          slug: "fantasy-pack",
          updated_at: "2026-07-07T00:00:00Z",
        },
        {
          created_at: "2026-07-07T00:00:00Z",
          description: "Animal words",
          id: "550e8400-e29b-41d4-a716-446655440002",
          is_active: true,
          name: "Animals Pack",
          slug: "animals-pack",
          updated_at: "2026-07-07T00:00:00Z",
        },
      ],
    }),
    ok: true,
  });
}

function validStartGameResponse({
  drawerParticipantId = "550e8400-e29b-41d4-a716-446655440012",
}: {
  drawerParticipantId?: string;
} = {}) {
  return {
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
      drawer_participant_id: drawerParticipantId,
      word_id: "550e8400-e29b-41d4-a716-446655440014",
      word_text_snapshot: "castle",
      status: "started",
      duration_seconds: 60,
      started_at: "2026-07-07T00:00:00Z",
      ended_at: null,
    },
  };
}
