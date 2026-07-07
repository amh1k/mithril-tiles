"use client";

import {
  Clock,
  Crown,
  Eraser,
  MessageSquareText,
  Palette,
  Play,
  Send,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

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
import {
  createPlaceholderRoomSnapshot,
  type RoomPlayer,
} from "@/features/rooms/room-state";
import {
  wordPackResponseSchema,
  type WordPack,
} from "@/features/rooms/word-pack";
import { useRoomStore } from "@/stores/room-store";

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
  const [wordPack, setWordPack] = useState<WordPack | null>(null);
  const [wordPackStatus, setWordPackStatus] = useState<
    "idle" | "preparing" | "ready" | "failed"
  >("idle");
  const isErasing = drawingColor === ERASER_COLOR;
  const placeholderRoomSnapshot = useMemo(
    () => createPlaceholderRoomSnapshot(principal),
    [principal],
  );
  const roomSnapshot =
    useRoomStore((state) => state.snapshot) ?? placeholderRoomSnapshot;
  const setRoomSnapshot = useRoomStore((state) => state.setSnapshot);
  const currentPlayer = roomSnapshot.players[0];
  const socketStatusLabel = formatSocketStatus(socket.status);

  useEffect(() => {
    setRoomSnapshot(placeholderRoomSnapshot);
  }, [placeholderRoomSnapshot, setRoomSnapshot]);

  useEffect(() => {
    const abortController = new AbortController();

    async function prepareWordPack() {
      setWordPackStatus("preparing");

      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomCode)}/word-pack`,
        {
          cache: "no-store",
          method: "POST",
          signal: abortController.signal,
        },
      ).catch(() => undefined);

      if (abortController.signal.aborted) {
        return;
      }

      if (response === undefined || !response.ok) {
        setWordPackStatus("failed");
        return;
      }

      const parsedResponse = wordPackResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );

      if (!parsedResponse.success) {
        setWordPackStatus("failed");
        return;
      }

      setWordPack(parsedResponse.data.word_pack);
      setWordPackStatus("ready");
    }

    void prepareWordPack();

    return () => {
      abortController.abort();
    };
  }, [roomCode]);

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
            Lobby
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {principal.display_name}. Chat and free drawing are
            live; authoritative players, roles, rounds, and scores will replace
            the placeholders once the backend room snapshot lands.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[28rem]">
          <StatusTile
            icon={Users}
            label="Players"
            value={`${roomSnapshot.players.length} online`}
          />
          <StatusTile
            icon={Clock}
            label="Round"
            value={roomSnapshot.roundLabel}
          />
          <StatusTile
            icon={Palette}
            label="Mode"
            value={roomSnapshot.modeLabel}
          />
          <StatusTile
            icon={MessageSquareText}
            label="Socket"
            value={socketStatusLabel}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Players</CardTitle>
                <CardDescription>
                  Lobby snapshot placeholder.
                </CardDescription>
              </div>
              <span className="rounded-full border bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {socketStatusLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlayerCard player={currentPlayer} />

            <Button className="w-full gap-2" disabled type="button">
              <Play className="size-4" aria-hidden="true" />
              Start game
            </Button>

            <WordPackStatus wordPack={wordPack} status={wordPackStatus} />

            <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              Start game stays disabled until the frontend receives an
              authoritative host/player snapshot and word-pack selection flow.
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Canvas</CardTitle>
                <CardDescription>
                  Free draw preview is enabled now. Drawer-only permissions will
                  be enforced when round state is wired.
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
            <DrawingCanvas
              color={drawingColor}
              isErasing={isErasing}
              // Keep free drawing local in the placeholder lobby. The current
              // backend closes idle-room sockets when it receives draw_stroke.
              onStroke={undefined}
              remoteStrokes={socket.drawStrokes}
            />
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

type PlayerCardProps = {
  player: RoomPlayer;
};

function PlayerCard({ player }: PlayerCardProps) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {player.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">
              {player.displayName}
            </p>
            <span className="text-xs font-semibold text-muted-foreground">
              {player.score}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <PlayerBadge
              icon={Crown}
              label={player.isHost ? "Host" : "Host pending"}
            />
            <PlayerBadge icon={ShieldCheck} label={player.principalType} />
          </div>
        </div>
      </div>
    </div>
  );
}

type PlayerBadgeProps = {
  icon: LucideIcon;
  label: string;
};

function PlayerBadge({ icon: Icon, label }: PlayerBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

type WordPackStatusProps = {
  status: "idle" | "preparing" | "ready" | "failed";
  wordPack: WordPack | null;
};

function WordPackStatus({ status, wordPack }: WordPackStatusProps) {
  if (status === "ready" && wordPack !== null) {
    return (
      <div className="rounded-lg border bg-primary/5 p-3 text-xs">
        <p className="font-medium text-primary">Word pack ready</p>
        <p className="mt-1 text-muted-foreground">{wordPack.name}</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        Word pack could not be prepared. Registered users can retry by
        re-entering the room.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
      Preparing temporary word pack…
    </div>
  );
}
