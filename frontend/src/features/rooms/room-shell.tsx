"use client";

import {
  Clock,
  Eraser,
  MessageSquareText,
  Palette,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Principal } from "@/features/auth/schemas";
import { DrawingCanvas } from "@/features/drawing/drawing-canvas";
import { useRoomSocket } from "@/features/realtime/use-room-socket";
import type { RoomCode } from "@/features/rooms/room-code";

type RoomShellProps = {
  principal: Principal;
  roomCode: RoomCode;
};

const DRAWING_COLORS = [
  {
    label: "Black",
    value: "#111827",
  },
  {
    label: "Red",
    value: "#ef4444",
  },
  {
    label: "Amber",
    value: "#f59e0b",
  },
  {
    label: "Emerald",
    value: "#10b981",
  },
  {
    label: "Sky",
    value: "#0ea5e9",
  },
  {
    label: "Violet",
    value: "#8b5cf6",
  },
  {
    label: "Pink",
    value: "#ec4899",
  },
];
const ERASER_COLOR = "#ffffff";

export function RoomShell({ principal, roomCode }: RoomShellProps) {
  const socket = useRoomSocket({ roomCode });
  const [chatMessage, setChatMessage] = useState("");
  const [drawingColor, setDrawingColor] = useState(DRAWING_COLORS[0].value);
  const isErasing = drawingColor === ERASER_COLOR;

  function handleSendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (socket.sendChatMessage(chatMessage)) {
      setChatMessage("");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <section className="grid gap-4 rounded-2xl border bg-card/80 p-4 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Room {roomCode}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Waiting room
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {principal.display_name}. Socket connection, lobby
            updates, chat, and drawing will plug into this screen next.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[28rem]">
          <StatusTile icon={Users} label="Players" value="Pending" />
          <StatusTile icon={Clock} label="Round" value="Lobby" />
          <StatusTile icon={Palette} label="Drawer" value="TBD" />
          <StatusTile
            icon={MessageSquareText}
            label="Socket"
            value={formatSocketStatus(socket.status)}
          />
        </div>
      </section>

      {socket.status === "failed" && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="status"
        >
          {socket.errorMessage ??
            "The realtime connection could not be established."}
        </div>
      )}

      <section className="grid min-h-0 gap-4 lg:h-[calc(100vh-15rem)] lg:min-h-[34rem] lg:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>Players</CardTitle>
            <CardDescription>
              Host, drawer, and scores will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Player snapshot not connected yet.
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Canvas</CardTitle>
                <CardDescription>
                  The drawing surface will mount here after the realtime
                  connection is in place.
                </CardDescription>
              </div>

              <div
                className="flex flex-wrap gap-2"
                aria-label="Drawing tool"
                role="radiogroup"
              >
                {DRAWING_COLORS.map((color) => (
                  <button
                    key={color.value}
                    aria-checked={drawingColor === color.value}
                    aria-label={color.label}
                    className="size-7 rounded-full border border-foreground/20 ring-offset-background transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-checked:ring-2 aria-checked:ring-ring aria-checked:ring-offset-2"
                    onClick={() => setDrawingColor(color.value)}
                    role="radio"
                    style={{
                      backgroundColor: color.value,
                    }}
                    type="button"
                  />
                ))}
                <button
                  aria-checked={isErasing}
                  aria-label="Eraser"
                  className="flex size-7 items-center justify-center rounded-full border border-foreground/20 bg-white text-slate-900 ring-offset-background transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-checked:ring-2 aria-checked:ring-ring aria-checked:ring-offset-2"
                  onClick={() => setDrawingColor(ERASER_COLOR)}
                  role="radio"
                  type="button"
                >
                  <Eraser className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1">
            <DrawingCanvas color={drawingColor} isErasing={isErasing} />
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>Chat & guesses</CardTitle>
            <CardDescription>
              Messages and system activity will stream here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <div
              data-testid="chat-message-list"
              className="flex min-h-[18rem] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg border bg-background/60 p-3 text-sm lg:min-h-0"
              aria-live="polite"
            >
              {socket.messages.length === 0 ? (
                <p className="text-muted-foreground">No chat messages yet.</p>
              ) : (
                socket.messages.map((message) => (
                  <p key={message.id} className="whitespace-pre-wrap">
                    {message.text}
                  </p>
                ))
              )}
            </div>

            <form className="flex gap-2" onSubmit={handleSendChatMessage}>
              <Input
                aria-label="Chat message"
                autoComplete="off"
                disabled={socket.status !== "connected"}
                onChange={(event) => setChatMessage(event.target.value)}
                placeholder={
                  socket.status === "connected"
                    ? "Send a message..."
                    : "Waiting for connection..."
                }
                value={chatMessage}
              />
              <Button
                disabled={
                  socket.status !== "connected" || chatMessage.trim() === ""
                }
                size="icon"
                type="submit"
              >
                <Send className="size-4" aria-hidden="true" />
                <span className="sr-only">Send message</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function formatSocketStatus(status: string): string {
  switch (status) {
    case "requesting_ticket":
      return "Ticket";
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting";
    case "closed":
      return "Closed";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

type StatusTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function StatusTile({ icon: Icon, label, value }: StatusTileProps) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  );
}
