"use client";

import {
  Check,
  CircleAlert,
  Clock,
  Copy,
  Crown,
  Eraser,
  Eye,
  LoaderCircle,
  MessageSquareText,
  Paintbrush,
  Palette,
  Play,
  Send,
  ShieldCheck,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
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
  realtimeSnapshotToRoomSnapshot,
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
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);
  const [drawingColor, setDrawingColor] = useState(DRAWING_COLORS[0].value);
  const [wordPacks, setWordPacks] = useState<WordPack[]>([]);
  const [wordPack, setWordPack] = useState<WordPack | null>(null);
  const [selectedWordPackId, setSelectedWordPackId] = useState("");
  const [wordPackStatus, setWordPackStatus] = useState<
    "idle" | "preparing" | "ready" | "failed"
  >("idle");
  const [startGameError, setStartGameError] = useState<string | null>(null);
  const [startGameStatus, setStartGameStatus] = useState<
    "idle" | "starting" | "started"
  >("idle");
  const [finalScores, setFinalScores] = useState<GameFinalScore[]>([]);
  const [finalScoresDismissed, setFinalScoresDismissed] = useState(false);
  const [finalScoresStatus, setFinalScoresStatus] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  const isErasing = drawingColor === ERASER_COLOR;
  const placeholderRoomSnapshot = useMemo(
    () => createPlaceholderRoomSnapshot(principal),
    [principal],
  );
  const storedRoomSnapshot = useRoomStore((state) => state.snapshot);
  const roomSnapshot = storedRoomSnapshot ?? placeholderRoomSnapshot;
  const setRoomSnapshot = useRoomStore((state) => state.setSnapshot);
  const socketStatusLabel = formatSocketStatus(socket.status);
  const rankedPlayers = useMemo(
    () =>
      [...roomSnapshot.players].sort(
        (firstPlayer, secondPlayer) => secondPlayer.score - firstPlayer.score,
      ),
    [roomSnapshot.players],
  );

  useEffect(() => {
    if (storedRoomSnapshot === null) {
      setRoomSnapshot(placeholderRoomSnapshot);
    }
  }, [placeholderRoomSnapshot, setRoomSnapshot, storedRoomSnapshot]);

  useEffect(() => {
    if (socket.roomSnapshot === null) {
      return;
    }

    setRoomSnapshot(
      realtimeSnapshotToRoomSnapshot(socket.roomSnapshot, principal.id),
    );
  }, [principal.id, setRoomSnapshot, socket.roomSnapshot]);

  useEffect(() => {
    const activeWordPackId = socket.roomSnapshot?.game?.word_pack_id;

    if (activeWordPackId === undefined || wordPack !== null) {
      return;
    }

    const activeWordPack =
      wordPacks.find((pack) => pack.id === activeWordPackId) ?? null;

    if (activeWordPack !== null) {
      setSelectedWordPackId(activeWordPack.id);
      setWordPack(activeWordPack);
    }
  }, [socket.roomSnapshot, wordPack, wordPacks]);

  useEffect(() => {
    if (socket.gameEndedAt == null || roomSnapshot.gameId == null) {
      return;
    }

    const abortController = new AbortController();

    async function loadFinalScores() {
      setFinalScoresDismissed(false);
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
      setSelectedWordPackId(activeWordPacks[0]?.id ?? "");
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

  function handleConfirmWordPack() {
    const selectedWordPack =
      wordPacks.find((pack) => pack.id === selectedWordPackId) ?? null;

    setWordPack(selectedWordPack);
  }

  async function handleCopyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setRoomCodeCopied(true);
    } catch {
      setRoomCodeCopied(false);
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
    (socket.roomSnapshot === null || roomSnapshot.canStartGame) &&
    wordPackStatus === "ready" &&
    wordPack !== null &&
    startGameStatus === "idle" &&
    socket.status === "connected";
  const isCurrentPlayerDrawer =
    roomSnapshot.drawerName === principal.display_name;
  const isCurrentPlayerHost = roomSnapshot.players.some(
    (player) => player.id === principal.id && player.isHost,
  );
  const shouldSendDrawStrokes =
    isCurrentPlayerDrawer &&
    (roomSnapshot.phase === "active_round" ||
      startGameStatus === "started") &&
    socket.status === "connected";

  if (wordPack === null && isCurrentPlayerHost) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <WordPackSelectionPanel
          selectedWordPackId={selectedWordPackId}
          status={wordPackStatus}
          wordPacks={wordPacks}
          isHost={isCurrentPlayerHost}
          onConfirm={handleConfirmWordPack}
          onSelect={setSelectedWordPackId}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <section className="grid gap-5 overflow-hidden rounded-2xl border bg-card/80 p-4 shadow-sm sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Room
            </span>
            <span className="font-mono text-sm font-semibold tracking-widest">
              {roomCode}
            </span>
            <Button
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={handleCopyRoomCode}
              size="sm"
              type="button"
              variant="outline"
            >
              {roomCodeCopied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {roomCodeCopied ? "Copied" : "Copy code"}
            </Button>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {roomSnapshot.phase === "lobby" ? "Game lobby" : "Game in progress"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Playing as{" "}
            <span className="font-medium text-foreground">
              {principal.display_name}
            </span>
            {isCurrentPlayerHost
              ? ". You control the game setup."
              : ". Waiting for the host to start the game."}
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

      <ConnectionNotice
        errorMessage={socket.errorMessage}
        retryAttempt={socket.retryAttempt}
        status={socket.status}
      />

      <section className="grid min-h-0 gap-4 lg:h-[calc(100vh-15rem)] lg:min-h-[34rem] lg:grid-cols-[14rem_minmax(0,1fr)_18rem] xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <Card className="order-2 min-h-0 lg:order-1">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Players</CardTitle>
                <CardDescription>
                  {roomSnapshot.phase === "active_round"
                    ? "Current players and round scores."
                    : "Everyone currently in this room."}
                </CardDescription>
              </div>
              <span className="rounded-full border bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {socketStatusLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {rankedPlayers.map((player, index) => (
                <PlayerCard key={player.id} player={player} rank={index + 1} />
              ))}
            </div>

            {isCurrentPlayerHost ? (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Host controls
                </p>
                <Button
                  className="w-full gap-2"
                  disabled={!canStartGame}
                  onClick={handleStartGame}
                  size="lg"
                  type="button"
                >
                  <Play className="size-4" aria-hidden="true" />
                  {startGameStatus === "starting"
                    ? "Starting game…"
                    : "Start game"}
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {startGameStatus === "started"
                    ? "The game has started."
                    : socket.status !== "connected"
                      ? "Reconnect to realtime before starting."
                      : "Start when everyone is ready."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/30 p-3 text-sm">
                <p className="font-medium">Waiting for the host</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The host will start the game when everyone is ready.
                </p>
              </div>
            )}

            <WordPackStatus wordPack={wordPack} status={wordPackStatus} />

            <StartGameStatus
              errorMessage={startGameError}
              status={startGameStatus}
            />
          </CardContent>
        </Card>

        <Card
          className={`order-1 min-h-0 lg:order-2 ${
            roomSnapshot.phase === "active_round"
              ? "border-primary/30 shadow-lg shadow-primary/5"
              : ""
          }`}
        >
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Canvas</CardTitle>
                  {roomSnapshot.phase === "active_round" && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        isCurrentPlayerDrawer
                          ? "bg-primary/10 text-primary"
                          : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      }`}
                    >
                      {isCurrentPlayerDrawer ? (
                        <Paintbrush className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="size-3.5" aria-hidden="true" />
                      )}
                      {isCurrentPlayerDrawer
                        ? "Your turn to draw"
                        : `Watching ${roomSnapshot.drawerName ?? "the drawer"}`}
                    </span>
                  )}
                </div>
                <CardDescription>
                  {roomSnapshot.phase === "active_round"
                    ? isCurrentPlayerDrawer
                      ? "Draw clearly—the room is watching in real time."
                      : "Watch the drawing and submit your guess in chat."
                    : "Test the canvas while everyone gets ready."}
                </CardDescription>
                {socket.drawerWord !== null && (
                  <p className="mt-3 inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                    Your word: {socket.drawerWord.word}
                  </p>
                )}
              </div>

              {(roomSnapshot.phase !== "active_round" ||
                isCurrentPlayerDrawer) && (
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
                      className="size-8 rounded-full border border-foreground/20 ring-offset-background transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-checked:ring-2 aria-checked:ring-ring aria-checked:ring-offset-2"
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
                    className="flex size-8 items-center justify-center rounded-full border border-foreground/20 bg-white text-slate-900 ring-offset-background transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-checked:ring-2 aria-checked:ring-ring aria-checked:ring-offset-2"
                    onClick={() => setDrawingColor(ERASER_COLOR)}
                    role="radio"
                    type="button"
                  >
                    <Eraser className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
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

        <Card className="order-3 min-h-0">
          <CardHeader>
            <CardTitle>Chat & guesses</CardTitle>
            <CardDescription>
              {roomSnapshot.phase === "active_round"
                ? "Share reactions or submit a guess."
                : "Chat with everyone in the room."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <div
              data-testid="chat-message-list"
              className="flex min-h-[18rem] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg border bg-background/60 p-3 text-sm lg:min-h-0"
              aria-live="polite"
            >
              {socket.messages.length === 0 ? (
                <p className="text-muted-foreground">
                  {roomSnapshot.phase === "active_round"
                    ? "Guesses and room activity will appear here."
                    : "No chat messages yet."}
                </p>
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
                    ? roomSnapshot.phase === "active_round" &&
                      !isCurrentPlayerDrawer
                      ? "Type /guess followed by your answer"
                      : "Send a message..."
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

      {!finalScoresDismissed && (
        <FinalScoresOverlay
          finalScores={finalScores}
          onClose={() => setFinalScoresDismissed(true)}
          status={finalScoresStatus}
        />
      )}
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

type ConnectionNoticeProps = {
  errorMessage?: string;
  retryAttempt: number;
  status: string;
};

function ConnectionNotice({
  errorMessage,
  retryAttempt,
  status,
}: ConnectionNoticeProps) {
  if (status === "connected") {
    return (
      <div
        className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300"
        role="status"
      >
        <Wifi className="size-4" aria-hidden="true" />
        <span>Realtime connection established.</span>
      </div>
    );
  }

  if (
    status === "requesting_ticket" ||
    status === "connecting" ||
    status === "reconnecting"
  ) {
    const isOffline = errorMessage?.toLowerCase().includes("offline") ?? false;
    const Icon = isOffline ? WifiOff : LoaderCircle;

    return (
      <div
        aria-live="polite"
        className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        role="status"
      >
        <Icon
          className={`mt-0.5 size-4 shrink-0 ${isOffline ? "" : "animate-spin"}`}
          aria-hidden="true"
        />
        <div>
          <p className="font-medium">
            {isOffline ? "You are offline" : "Restoring realtime connection"}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {errorMessage ??
              "Chat and drawing will become available once connected."}
            {retryAttempt > 0 && !isOffline
              ? ` Retry attempt ${retryAttempt}.`
              : ""}
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div
        aria-live="assertive"
        className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Realtime connection unavailable</p>
          <p className="mt-0.5 text-xs opacity-80">
            {errorMessage ??
              "Chat and drawing are unavailable. Refresh the page to try again."}
          </p>
        </div>
      </div>
    );
  }

  return null;
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
  rank: number;
};

function PlayerCard({ player, rank }: PlayerCardProps) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {player.displayName.slice(0, 2).toUpperCase()}
          </div>
          <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border bg-background text-[0.6rem] font-bold text-muted-foreground">
            {rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{player.displayName}</p>
            <span
              className="text-xs font-semibold text-muted-foreground"
              aria-label={`${player.score} points`}
            >
              {player.score} pts
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {player.isHost && <PlayerBadge icon={Crown} label="Host" />}
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
      <div className="rounded-xl border bg-background/70 p-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Palette className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Selected word pack
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold">
              {wordPack.name}
            </p>
            {wordPack.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {wordPack.description}
              </p>
            )}
          </div>
        </div>
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
      Choose a word pack to unlock game start.
    </div>
  );
}

type WordPackSelectionPanelProps = {
  isHost: boolean;
  onConfirm: () => void;
  onSelect: (wordPackId: string) => void;
  selectedWordPackId: string;
  status: "idle" | "preparing" | "ready" | "failed";
  wordPacks: WordPack[];
};

function WordPackSelectionPanel({
  isHost,
  onConfirm,
  onSelect,
  selectedWordPackId,
  status,
  wordPacks,
}: WordPackSelectionPanelProps) {
  if (status === "preparing" || status === "idle") {
    return (
      <section className="flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border bg-card/80 p-6 text-center shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Loading word packs…
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Preparing the lobby
          </h2>
        </div>
      </section>
    );
  }

  if (status === "failed") {
    return (
      <section className="flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-700 shadow-sm dark:text-amber-300">
        Word packs could not be loaded. Re-enter the room to retry.
      </section>
    );
  }

  if (wordPacks.length === 0) {
    return (
      <section className="flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-700 shadow-sm dark:text-amber-300">
        No active word packs are available.
      </section>
    );
  }

  if (!isHost) {
    return (
      <section className="flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border bg-card/80 p-6 text-center shadow-sm">
        <div className="max-w-md">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Waiting for host
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            The host is choosing a word pack
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You will enter the room once the host locks the pack for this game.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border bg-card/80 p-4 shadow-sm sm:p-6">
      <div className="flex max-h-full w-full max-w-2xl flex-col">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Choose the word pack
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Pick the theme for this room
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Once selected, this pack is locked for the game.
          </p>
        </div>

        <div className="mt-6 grid min-h-0 gap-3 overflow-y-auto pr-1">
          {wordPacks.map((pack) => (
            <button
              className="rounded-2xl border bg-background/70 p-4 text-left transition hover:border-primary/50 hover:bg-primary/5 aria-pressed:border-primary aria-pressed:bg-primary/10"
              key={pack.id}
              onClick={() => onSelect(pack.id)}
              type="button"
              aria-pressed={selectedWordPackId === pack.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{pack.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pack.description || pack.slug}
                  </p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                  {pack.slug}
                </span>
              </div>
            </button>
          ))}
        </div>

        <Button
          className="mt-6 w-full"
          disabled={selectedWordPackId === ""}
          onClick={onConfirm}
          type="button"
        >
          Lock word pack
        </Button>
      </div>
    </section>
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
  onClose: () => void;
  status: "idle" | "loading" | "ready" | "failed";
};

function FinalScoresOverlay({
  finalScores,
  onClose,
  status,
}: FinalScoresStatusProps) {
  if (status === "idle") {
    return null;
  }

  if (status === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
        <div
          aria-labelledby="final-scores-loading-title"
          aria-modal="true"
          className="w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-2xl"
          role="dialog"
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Trophy className="size-7 animate-pulse" aria-hidden="true" />
          </div>
          <h2
            className="mt-4 text-2xl font-semibold tracking-tight"
            id="final-scores-loading-title"
          >
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
        <div
          aria-labelledby="final-scores-error-title"
          aria-modal="true"
          className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-card p-6 text-center shadow-2xl"
          role="dialog"
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <Trophy className="size-7" aria-hidden="true" />
          </div>
          <h2
            className="mt-4 text-2xl font-semibold tracking-tight"
            id="final-scores-error-title"
          >
            Game over
          </h2>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Final scores could not be loaded yet. They may still be saving.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={onClose} type="button" variant="outline">
              Return to room
            </Button>
            <Link className={buttonVariants()} href="/play">
              Leave room
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sortedScores = [...finalScores].sort(
    (left, right) => left.final_rank - right.final_rank,
  );
  const winner = sortedScores.find((score) => score.is_winner);
  const podiumScores = sortedScores.slice(0, 3);
  const remainingScores = sortedScores.slice(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 py-6 backdrop-blur-sm">
      <div
        aria-labelledby="final-scores-title"
        aria-modal="true"
        className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
        role="dialog"
      >
        <Button
          aria-label="Close final scores"
          className="absolute right-3 top-3 z-10 rounded-full"
          onClick={onClose}
          size="icon"
          type="button"
          variant="secondary"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
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

        <div className="min-h-0 space-y-5 overflow-y-auto p-4 sm:p-6">
          {sortedScores.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="font-medium">Scores are still being prepared</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The game ended successfully, but no persisted scores were
                returned yet.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {podiumScores.map((score) => (
                  <ScorePodiumCard key={score.id} score={score} />
                ))}
              </div>
              {remainingScores.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Final standings
                  </p>
                  {remainingScores.map((score) => (
                    <ScoreRow key={score.id} score={score} />
                  ))}
                </div>
              )}
            </>
          )}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button onClick={onClose} type="button" variant="outline">
              Return to room
            </Button>
            <Link className={buttonVariants()} href="/play">
              Leave room
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScorePodiumCard({ score }: { score: GameFinalScore }) {
  return (
    <div
      className={`rounded-2xl border p-4 text-center ${
        score.is_winner
          ? "border-amber-500/40 bg-amber-500/10"
          : "bg-background/70"
      }`}
    >
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
        #{score.final_rank}
      </div>
      <p className="mt-3 truncate font-semibold">
        {finalScoreDisplayName(score)}
      </p>
      {score.is_winner && (
        <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Winner
        </span>
      )}
      <p className="mt-3 text-2xl font-bold tabular-nums">
        {score.final_score}
      </p>
      <p className="text-xs text-muted-foreground">points</p>
    </div>
  );
}

function ScoreRow({ score }: { score: GameFinalScore }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background/70 p-3">
      <span className="w-8 text-center text-sm font-bold text-muted-foreground">
        #{score.final_rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {finalScoreDisplayName(score)}
        </p>
        <p className="text-xs text-muted-foreground">
          Participant {shortParticipantId(score.participant_id)}
        </p>
      </div>
      <p className="font-bold tabular-nums">{score.final_score} pts</p>
    </div>
  );
}

function finalScoreDisplayName(score: GameFinalScore): string {
  return `Player ${score.final_rank}`;
}

function shortParticipantId(participantId: string): string {
  return participantId.slice(0, 8);
}
