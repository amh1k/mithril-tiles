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
  Trophy,
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
import {
  fetchFinalScores,
  type GameFinalScore,
} from "@/features/rooms/final-scores";
import type { RoomCode } from "@/features/rooms/room-code";
import { startGameResponseSchema } from "@/features/rooms/start-game";
import {
  createPlaceholderRoomSnapshot,
  startGameResponseToRoomSnapshot,
  type RoomPlayer,
} from "@/features/rooms/room-state";
import {
  wordPacksResponseSchema,
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
  const [wordPacks, setWordPacks] = useState<WordPack[]>([]);
  const [wordPack, setWordPack] = useState<WordPack | null>(null);
  const [wordPackStatus, setWordPackStatus] = useState<
    "idle" | "preparing" | "ready" | "failed"
  >("idle");
  const [startGameError, setStartGameError] = useState<string | null>(null);
  const [startGameStatus, setStartGameStatus] = useState<
    "idle" | "starting" | "started"
  >("idle");
  const [finalScores, setFinalScores] = useState<GameFinalScore[]>([]);
  const [finalScoresStatus, setFinalScoresStatus] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  const isErasing = drawingColor === ERASER_COLOR;
  const placeholderRoomSnapshot = useMemo(
    () => createPlaceholderRoomSnapshot(principal),
    [principal],
  );
  const roomSnapshot =
    useRoomStore((state) => state.snapshot) ?? placeholderRoomSnapshot;
  const setRoomSnapshot = useRoomStore((state) => state.setSnapshot);
  const socketStatusLabel = formatSocketStatus(socket.status);

  useEffect(() => {
    setRoomSnapshot(placeholderRoomSnapshot);
  }, [placeholderRoomSnapshot, setRoomSnapshot]);

  useEffect(() => {
    if (socket.gameEndedAt == null || roomSnapshot.gameId == null) {
      return;
    }

    const abortController = new AbortController();

    async function loadFinalScores() {
      setFinalScoresStatus("loading");

      try {
        const response = await fetchFinalScores(
          roomSnapshot.gameId!,
          abortController.signal,
        );

        if (abortController.signal.aborted) {
          return;
        }

        setFinalScores(response.game_final_scores);
        setFinalScoresStatus("ready");
      } catch {
        if (!abortController.signal.aborted) {
          setFinalScoresStatus("failed");
        }
      }
    }

    void loadFinalScores();

    return () => {
      abortController.abort();
    };
  }, [roomSnapshot.gameId, socket.gameEndedAt]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadWordPacks() {
      setWordPackStatus("preparing");

      const response = await fetch("/api/word-packs", {
        cache: "no-store",
        method: "GET",
        signal: abortController.signal,
      }).catch(() => undefined);

      if (abortController.signal.aborted) {
        return;
      }

      if (response === undefined || !response.ok) {
        setWordPackStatus("failed");
        return;
      }

      const parsedResponse = wordPacksResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );

      if (!parsedResponse.success) {
        setWordPackStatus("failed");
        return;
      }

      const activeWordPacks = parsedResponse.data.word_packs.filter(
        (pack) => pack.is_active,
      );

      setWordPacks(activeWordPacks);
      setWordPack(activeWordPacks[0] ?? null);
      setWordPackStatus("ready");
    }

    void loadWordPacks();

    return () => {
      abortController.abort();
    };
  }, []);

  function handleSendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (socket.sendChatMessage(chatMessage)) {
      setChatMessage("");
    }
  }

  async function handleStartGame() {
    if (wordPack === null || startGameStatus === "starting") {
      return;
    }

    setStartGameError(null);
    setStartGameStatus("starting");

    const response = await fetch(
      `/api/rooms/${encodeURIComponent(roomCode)}/start`,
      {
        body: JSON.stringify({
          word_pack_id: wordPack.id,
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    ).catch(() => undefined);

    if (response === undefined) {
      setStartGameError("The game service is temporarily unavailable.");
      setStartGameStatus("idle");
      return;
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => undefined);
      const message =
        typeof errorBody?.message === "string"
          ? errorBody.message
          : "The game could not be started.";

      setStartGameError(message);
      setStartGameStatus("idle");
      return;
    }

    const parsedResponse = startGameResponseSchema.safeParse(
      await response.json().catch(() => undefined),
    );

    if (!parsedResponse.success) {
      setStartGameError(
        "Game start was accepted, but the response could not be fully understood.",
      );
      setStartGameStatus("idle");
      return;
    }

    setRoomSnapshot(startGameResponseToRoomSnapshot(parsedResponse.data));
    setStartGameStatus("started");
  }

  const canStartGame =
    wordPackStatus === "ready" &&
    wordPack !== null &&
    startGameStatus === "idle";
  const isCurrentPlayerDrawer =
    roomSnapshot.drawerName === principal.display_name;
  const shouldSendDrawStrokes =
    isCurrentPlayerDrawer &&
    startGameStatus === "started" &&
    socket.status === "connected";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <section className="grid gap-4 rounded-2xl border bg-card/80 p-4 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Room {roomCode}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Lobby</h1>
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
            label={roomSnapshot.drawerName === null ? "Mode" : "Drawer"}
            value={roomSnapshot.drawerName ?? roomSnapshot.modeLabel}
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
                  {roomSnapshot.phase === "active_round"
                    ? "Active round state."
                    : "Lobby snapshot placeholder."}
                </CardDescription>
              </div>
              <span className="rounded-full border bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {socketStatusLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {roomSnapshot.players.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>

            <Button
              className="w-full gap-2"
              disabled={!canStartGame}
              onClick={handleStartGame}
              type="button"
            >
              <Play className="size-4" aria-hidden="true" />
              {startGameStatus === "starting" ? "Starting…" : "Start game"}
            </Button>

            <WordPackStatus wordPack={wordPack} status={wordPackStatus} />

            <WordPackSelector
              selectedWordPackId={wordPack?.id ?? ""}
              status={wordPackStatus}
              wordPacks={wordPacks}
              onChange={(wordPackId) => {
                setWordPack(
                  wordPacks.find((pack) => pack.id === wordPackId) ?? null,
                );
              }}
            />

            <StartGameStatus
              errorMessage={startGameError}
              status={startGameStatus}
            />

            <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              Select a word pack before starting. The backend may still reject
              the request until enough players have joined and the current user
              is the room host.
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Canvas</CardTitle>
                <CardDescription>
                  Drawing stays local in the lobby and syncs through the socket
                  after the game start request is accepted.
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
              disabled={
                roomSnapshot.phase === "active_round" && !isCurrentPlayerDrawer
              }
              isErasing={isErasing}
              onStroke={
                shouldSendDrawStrokes ? socket.sendDrawStroke : undefined
              }
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

      <FinalScoresOverlay
        finalScores={finalScores}
        status={finalScoresStatus}
      />
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
            <p className="truncate text-sm font-medium">{player.displayName}</p>
            <span className="text-xs font-semibold text-muted-foreground">
              {player.score}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <PlayerBadge
              icon={Crown}
              label={player.isHost ? "Host" : "Host pending"}
            />
            {player.isDrawer && <PlayerBadge icon={Palette} label="Drawer" />}
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
        <p className="font-medium text-primary">Word pack selected</p>
        <p className="mt-1 text-muted-foreground">{wordPack.name}</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        Word packs could not be loaded. Registered users can retry by
        re-entering the room.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
      Loading word packs…
    </div>
  );
}

type WordPackSelectorProps = {
  onChange: (wordPackId: string) => void;
  selectedWordPackId: string;
  status: "idle" | "preparing" | "ready" | "failed";
  wordPacks: WordPack[];
};

function WordPackSelector({
  onChange,
  selectedWordPackId,
  status,
  wordPacks,
}: WordPackSelectorProps) {
  if (status !== "ready") {
    return null;
  }

  if (wordPacks.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        No active word packs are available.
      </div>
    );
  }

  return (
    <label className="block space-y-2 text-xs">
      <span className="font-medium text-muted-foreground">Word pack</span>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        onChange={(event) => onChange(event.target.value)}
        value={selectedWordPackId}
      >
        {wordPacks.map((pack) => (
          <option key={pack.id} value={pack.id}>
            {pack.name}
          </option>
        ))}
      </select>
    </label>
  );
}

type StartGameStatusProps = {
  errorMessage: string | null;
  status: "idle" | "starting" | "started";
};

function StartGameStatus({ errorMessage, status }: StartGameStatusProps) {
  if (errorMessage !== null) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        {errorMessage}
      </div>
    );
  }

  if (status === "started") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
        Game start request accepted.
      </div>
    );
  }

  return null;
}

type FinalScoresStatusProps = {
  finalScores: GameFinalScore[];
  status: "idle" | "loading" | "ready" | "failed";
};

function FinalScoresOverlay({
  finalScores,
  status,
}: FinalScoresStatusProps) {
  if (status === "idle") {
    return null;
  }

  if (status === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-2xl">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Trophy className="size-7 animate-pulse" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            Game over
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Loading final scores…
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-card p-6 text-center shadow-2xl">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <Trophy className="size-7" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            Game over
          </h2>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Final scores could not be loaded yet.
          </p>
        </div>
      </div>
    );
  }

  const sortedScores = [...finalScores].sort(
    (left, right) => left.final_rank - right.final_rank,
  );
  const winner = sortedScores.find((score) => score.is_winner);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 py-6 backdrop-blur-sm">
      <div
        aria-labelledby="final-scores-title"
        aria-modal="true"
        className="w-full max-w-2xl overflow-hidden rounded-3xl border bg-card shadow-2xl"
        role="dialog"
      >
        <div className="relative overflow-hidden border-b bg-primary/10 px-6 py-7 text-center">
          <div className="absolute inset-x-8 top-0 h-24 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Trophy className="size-8" aria-hidden="true" />
          </div>
          <h2
            className="relative mt-4 text-3xl font-semibold tracking-tight"
            id="final-scores-title"
          >
            Game over
          </h2>
          <p className="relative mt-2 text-sm text-muted-foreground">
            {winner === undefined
              ? "Final rankings are ready."
              : `${finalScoreDisplayName(winner)} takes the crown.`}
          </p>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4 sm:p-6">
          {sortedScores.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No final scores were returned for this game.
            </div>
          ) : (
            sortedScores.map((score) => (
              <div
                className="flex items-center gap-4 rounded-2xl border bg-background/70 p-4"
                key={score.id}
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  #{score.final_rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">
                      {finalScoreDisplayName(score)}
                    </p>
                    {score.is_winner && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Winner
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Participant {shortParticipantId(score.participant_id)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums">
                    {score.final_score}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    points
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function finalScoreDisplayName(score: GameFinalScore): string {
  return `Player ${score.final_rank}`;
}

function shortParticipantId(participantId: string): string {
  return participantId.slice(0, 8);
}
