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
import { renderWithQueryClient } from "@/test/render-with-query-client";
import { RoomShell } from "./room-shell";

const useRoomSocketMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/realtime/use-room-socket", () => ({
  useRoomSocket: useRoomSocketMock,
}));

const principal: Principal = {
  type: "guest",
  id: "550e8400-e29b-41d4-a716-446655440000",
  display_name: "Player One",
};

function renderRoomShell({
  drawStrokes = [],
  errorMessage,
  messages = [],
  sendChatMessage = vi.fn(),
  sendDrawStroke = vi.fn(),
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
  messages?: Array<{ id: number; text: string }>;
  sendChatMessage?: ReturnType<typeof vi.fn>;
  sendDrawStroke?: ReturnType<typeof vi.fn>;
  status?: RoomSocketStatus;
} = {}) {
  useRoomSocketMock.mockReturnValue({
    drawStrokes,
    errorMessage,
    messages,
    retryAttempt: 0,
    sendChatMessage,
    sendDrawStroke,
    status,
  });

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
  });

  it("renders room context and received chat messages", () => {
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

    expect(screen.getByText("Room ROOM01")).toBeInTheDocument();
    expect(screen.getAllByText("Connected")).not.toHaveLength(0);
    expect(
      screen.getByText("Welcome, Player One!"),
    ).toBeInTheDocument();
    expect(screen.getByText("[Player Two]: hello")).toBeInTheDocument();
  });

  it("keeps chat messages inside a scrollable panel", () => {
    renderRoomShell({
      messages: Array.from({ length: 40 }, (_, index) => ({
        id: index + 1,
        text: `message ${index + 1}`,
      })),
      status: "connected",
    });

    expect(screen.getByTestId("chat-message-list")).toHaveClass(
      "overflow-y-auto",
    );
    expect(screen.getByText("message 40")).toBeInTheDocument();
  });

  it("lets players choose a drawing color", async () => {
    const user = userEvent.setup();
    renderRoomShell();

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

    const input = screen.getByLabelText("Chat message");
    await user.type(input, "still pending");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(sendChatMessage).toHaveBeenCalledWith("still pending");
    expect(input).toHaveValue("still pending");
  });

  it("disables chat while the socket is disconnected", () => {
    renderRoomShell({ status: "connecting" });

    expect(screen.getByLabelText("Chat message")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
  });

  it("shows socket failure messages", () => {
    renderRoomShell({
      errorMessage: "The realtime ticket request was rejected.",
      status: "failed",
    });

    expect(screen.getAllByText("Failed")).not.toHaveLength(0);
    expect(
      screen.getByText("The realtime ticket request was rejected."),
    ).toBeInTheDocument();
  });
});
