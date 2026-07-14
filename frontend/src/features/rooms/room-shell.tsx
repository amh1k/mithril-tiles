"use client";

import {
  Bot,
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
  Sparkles,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type UIEvent,
} from "react";

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
import {
  useRoomSocket,
  type RoomSocketStatus,
} from "@/features/realtime/use-room-socket";
import {
  addBotToRoom,
  fetchActiveBotProfiles,
  removeBotFromRoom,
  type BotProfile,
} from "@/features/rooms/bot-profiles";
import {
  fetchFinalScores,
  fetchParticipantPrincipal,
  type ResolvedGameFinalScore,
} from "@/features/rooms/final-scores";
import type { RoomCode } from "@/features/rooms/room-code";
import { startGameResponseSchema } from "@/features/rooms/start-game";
import {
  createPlaceholderRoomSnapshot,
  realtimeSnapshotToRoomSnapshot,
  startGameResponseToRoomSnapshot,
  type RoomPlayer,
  type RoomSnapshot,
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
const BRUSH_SIZES = [
  { label: "Fine", value: 0.006 },
  { label: "Medium", value: 0.012 },
  { label: "Bold", value: 0.02 },
  { label: "Broad", value: 0.032 },
];

export function RoomShell({ principal, roomCode }: RoomShellProps) {
  const socket = useRoomSocket({ roomCode });
  const [chatMessage, setChatMessage] = useState("");
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);
  const [drawingColor, setDrawingColor] = useState(DRAWING_COLORS[0].value);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1].value);
  const [wordPacks, setWordPacks] = useState<WordPack[]>([]);
  const [wordPack, setWordPack] = useState<WordPack | null>(null);
  const [selectedWordPackId, setSelectedWordPackId] = useState("");
  const [botProfiles, setBotProfiles] = useState<BotProfile[]>([]);
  const [botProfilesStatus, setBotProfilesStatus] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  const [selectedBotProfileId, setSelectedBotProfileId] = useState("");
  const [pendingBotProfileId, setPendingBotProfileId] = useState<string | null>(null);
  const [botControlError, setBotControlError] = useState<string | null>(null);
  const [wordPackStatus, setWordPackStatus] = useState<
    "idle" | "preparing" | "ready" | "failed"
  >("idle");
  const [startGameError, setStartGameError] = useState<string | null>(null);
  const [startGameStatus, setStartGameStatus] = useState<
    "idle" | "starting" | "started"
  >("idle");
  const [finalScores, setFinalScores] = useState<ResolvedGameFinalScore[]>([]);
  const [finalScoresStatus, setFinalScoresStatus] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  const [roundTransition, setRoundTransition] = useState<{
    key: string;
    title: string;
    description: string;
    tone: "start" | "break";
  } | null>(null);
  const [showConnectionSuccess, setShowConnectionSuccess] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const previousRoundTransitionKeyRef = useRef<string | null>(null);
  const hasConnectedRef = useRef(false);
  const chatMessageListRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);
  const shouldAutoScrollChatRef = useRef(true);
  const isErasing = drawingColor === ERASER_COLOR;
  const placeholderRoomSnapshot = useMemo(
    () => createPlaceholderRoomSnapshot(principal),
    [principal],
  );
  const storedRoomSnapshot = useRoomStore((state) => state.snapshot);
  const roomSnapshot = storedRoomSnapshot ?? placeholderRoomSnapshot;
  const setRoomSnapshot = useRoomStore((state) => state.setSnapshot);
  const socketStatusLabel = formatSocketStatus(socket.status);
  const roundTimer = useRoundTimer(roomSnapshot);
  const canvasResetKey =
    roomSnapshot.phase === "active_round"
      ? `${roomSnapshot.gameId ?? "game"}:${roomSnapshot.roundStartedAt ?? roomSnapshot.roundLabel}`
      : "lobby";
  const rankedPlayers = useMemo(
    () =>
      [...roomSnapshot.players].sort(
        (firstPlayer, secondPlayer) => secondPlayer.score - firstPlayer.score,
      ),
    [roomSnapshot.players],
  );
  const isCurrentPlayerHost = roomSnapshot.players.some(
    (player) => player.id === principal.id && player.isHost,
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
    if (!isCurrentPlayerHost || roomSnapshot.phase !== "lobby") {
      return;
    }

    const controller = new AbortController();
    setBotProfilesStatus("loading");
    void fetchActiveBotProfiles(controller.signal)
      .then((profiles) => {
        setBotProfiles(profiles);
        setSelectedBotProfileId((currentID) => currentID || profiles[0]?.id || "");
        setBotProfilesStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setBotControlError(
          error instanceof Error ? error.message : "Bot profiles could not be loaded.",
        );
        setBotProfilesStatus("failed");
      });

    return () => controller.abort();
  }, [isCurrentPlayerHost, roomSnapshot.phase]);

  useEffect(() => {
    const transitionKey = `${roomSnapshot.phase}:${roomSnapshot.gameId ?? "none"}:${roomSnapshot.roundStartedAt ?? roomSnapshot.roundLabel}`;

    if (previousRoundTransitionKeyRef.current === null) {
      previousRoundTransitionKeyRef.current = transitionKey;
      return;
    }

    if (previousRoundTransitionKeyRef.current === transitionKey) {
      return;
    }

    const updateTransition = window.setTimeout(() => {
      previousRoundTransitionKeyRef.current = transitionKey;

      if (roomSnapshot.phase === "active_round") {
        setRoundTransition({
          key: transitionKey,
          title: roomSnapshot.roundLabel,
          description:
            roomSnapshot.drawerName === null
              ? "A new round has begun."
              : `${roomSnapshot.drawerName} takes the quill.`,
          tone: "start",
        });
      } else if (roomSnapshot.phase === "round_cooldown") {
        setRoundTransition({
          key: transitionKey,
          title: "Round complete",
          description:
            "Gather your guesses. The next parchment is being prepared.",
          tone: "break",
        });
      } else {
        setRoundTransition(null);
      }
    }, 0);

    return () => window.clearTimeout(updateTransition);
  }, [
    roomSnapshot.drawerName,
    roomSnapshot.gameId,
    roomSnapshot.phase,
    roomSnapshot.roundLabel,
    roomSnapshot.roundStartedAt,
  ]);

  useEffect(() => {
    if (roundTransition === null || roundTransition.tone !== "start") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRoundTransition((currentTransition) =>
        currentTransition?.key === roundTransition.key ? null : currentTransition,
      );
    }, 2200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [roundTransition]);

  useEffect(() => {
    if (socket.status !== "connected") {
      hasConnectedRef.current = false;
      const clearNotice = window.setTimeout(() => {
        setShowConnectionSuccess(false);
      }, 0);

      return () => window.clearTimeout(clearNotice);
    }

    if (hasConnectedRef.current) {
      return;
    }

    hasConnectedRef.current = true;
    const showNotice = window.setTimeout(() => {
      setShowConnectionSuccess(true);
    }, 0);
    const hideNotice = window.setTimeout(() => {
      setShowConnectionSuccess(false);
    }, 3_000);

    return () => {
      window.clearTimeout(showNotice);
      window.clearTimeout(hideNotice);
    };
  }, [socket.status]);

  useEffect(() => {
    const messageCount = socket.messages.length;
    const previousMessageCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messageCount;

    if (messageCount === 0 || messageCount === previousMessageCount) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const messageList = chatMessageListRef.current;
      if (messageList === null) {
        return;
      }

      if (shouldAutoScrollChatRef.current || previousMessageCount === 0) {
        if (typeof messageList.scrollTo === "function") {
          messageList.scrollTo({ behavior: "smooth", top: messageList.scrollHeight });
        } else {
          messageList.scrollTop = messageList.scrollHeight;
        }
        setUnreadMessageCount(0);
        return;
      }

      setUnreadMessageCount(messageCount - previousMessageCount);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [socket.messages.length]);

  useEffect(() => {
    const activeWordPackId = socket.roomSnapshot?.game?.word_pack_id;

    if (activeWordPackId === undefined || wordPack !== null) {
      return;
    }

    const activeWordPack =
      wordPacks.find((pack) => pack.id === activeWordPackId) ?? null;

    if (activeWordPack !== null) {
      const updateWordPack = window.setTimeout(() => {
        setSelectedWordPackId(activeWordPack.id);
        setWordPack(activeWordPack);
      }, 0);

      return () => window.clearTimeout(updateWordPack);
    }
  }, [socket.roomSnapshot, wordPack, wordPacks]);

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

        const resolvedScores = await Promise.all(
          response.game_final_scores.map(async (score) => {
            try {
              const scorePrincipal = await fetchParticipantPrincipal(
                score.game_id,
                score.participant_id,
                abortController.signal,
              );
              return {
                ...score,
                principal: scorePrincipal,
              };
            } catch {
              return {
                ...score,
                principal: null,
              };
            }
          }),
        );

        if (abortController.signal.aborted) {
          return;
        }

        setFinalScores(resolvedScores);
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

  function handleChatListScroll(event: UIEvent<HTMLDivElement>) {
    const messageList = event.currentTarget;
    const distanceFromBottom =
      messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight;

    shouldAutoScrollChatRef.current = distanceFromBottom < 36;

    if (shouldAutoScrollChatRef.current) {
      setUnreadMessageCount(0);
    }
  }

  function scrollChatToLatestMessage() {
    const messageList = chatMessageListRef.current;
    if (messageList === null) {
      return;
    }

    shouldAutoScrollChatRef.current = true;
    if (typeof messageList.scrollTo === "function") {
      messageList.scrollTo({ behavior: "smooth", top: messageList.scrollHeight });
    } else {
      messageList.scrollTop = messageList.scrollHeight;
    }
    setUnreadMessageCount(0);
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
  const guesserWord =
    roomSnapshot.phase === "active_round" &&
    socket.guesserWord != null &&
    socket.guesserWord.round_number === socket.roomSnapshot?.game?.round_number
      ? socket.guesserWord.word
      : null;
  const shouldSendDrawStrokes =
    isCurrentPlayerDrawer &&
    (roomSnapshot.phase === "active_round" ||
      startGameStatus === "started") &&
      socket.status === "connected";

  async function handleAddBot(botProfileId: string) {
    if (botProfileId === "") {
      return;
    }
    setBotControlError(null);
    setPendingBotProfileId(botProfileId);
    try {
      await addBotToRoom(roomCode, botProfileId);
    } catch (error) {
      setBotControlError(error instanceof Error ? error.message : "Bot could not be added.");
    } finally {
      setPendingBotProfileId(null);
    }
  }

  async function handleRemoveBot(botProfileId: string) {
    setBotControlError(null);
    setPendingBotProfileId(botProfileId);
    try {
      await removeBotFromRoom(roomCode, botProfileId);
    } catch (error) {
      setBotControlError(error instanceof Error ? error.message : "Bot could not be removed.");
    } finally {
      setPendingBotProfileId(null);
    }
  }

  if (socket.hasReceivedSnapshot === false) {
    return <RoomSynchronizingPanel socketStatus={socket.status} />;
  }

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
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <section className="grid gap-5 overflow-hidden rounded-2xl border bg-card/80 p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
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

        <div className="grid min-w-0 grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[28rem]">
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
        status={
          socket.status === "connected" && !showConnectionSuccess
            ? "idle"
            : socket.status
        }
      />

      {roundTimer !== null && (
        <section
          className={`mx-auto flex w-full max-w-xl items-center justify-center rounded-2xl border px-4 py-3 text-center shadow-xl transition-colors duration-500 sm:px-6 sm:py-4 ${
            roundTimer.remainingSeconds <= 5
              ? "timer-critical border-[#946440] bg-[#2b1e12] shadow-[#946440]/35"
              : roundTimer.remainingSeconds <= 15
                ? "border-[#946440]/85 bg-[#2b1e12]/95 shadow-[#946440]/20"
                : "border-[#bba88d]/60 bg-[#2b1e12]/90 shadow-[#2b1e12]/20"
          }`}
          aria-label="Round timer"
          aria-live={roundTimer.remainingSeconds <= 15 ? "polite" : undefined}
        >
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${
              roundTimer.remainingSeconds <= 5 ? "text-[#f0c39b]" : "text-[#bba88d]"
            }`}>
              {roundTimer.remainingSeconds <= 5 ? "Last moments" : "Time remaining"}
            </p>
            <p className={`mt-1 font-serif text-3xl font-bold tabular-nums sm:text-5xl ${
              roundTimer.remainingSeconds <= 5 ? "text-[#f0c39b]" : "text-[#f4ead7]"
            }`}>
              {roundTimer.label}
            </p>
          </div>
        </section>
      )}

      <RoundTransitionOverlay transition={roundTransition} />

      <section className="grid min-h-0 gap-4 lg:h-[42rem] lg:grid-cols-[14rem_minmax(0,1fr)_18rem] xl:h-[46rem] xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
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
              <span className="rounded-full border border-[#bba88d]/55 bg-[#6e6c34]/70 px-2 py-1 text-xs font-semibold text-[#f4ead7] shadow-sm">
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
                {roomSnapshot.phase === "lobby" && (
                  <BotLobbyControls
                    botProfiles={botProfiles}
                    errorMessage={botControlError}
                    onAdd={handleAddBot}
                    onRemove={handleRemoveBot}
                    onSelect={setSelectedBotProfileId}
                    pendingBotProfileId={pendingBotProfileId}
                    players={roomSnapshot.players}
                    selectedBotProfileId={selectedBotProfileId}
                    status={botProfilesStatus}
                  />
                )}
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
          className={`order-1 min-h-[30rem] lg:order-2 lg:min-h-0 ${
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
                      className={`status-enter inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
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
                <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                  {guesserWord !== null && <MaskedWordDisplay word={guesserWord} />}
                  {socket.drawerWord !== null && (
                    <p className="inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                      Your word: {socket.drawerWord.word}
                    </p>
                  )}
                </div>
              </div>

              {(roomSnapshot.phase !== "active_round" ||
                isCurrentPlayerDrawer) && (
                <div
                  className="panel-enter flex flex-wrap items-center gap-3"
                  aria-label="Drawing tool"
                  role="group"
                >
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Drawing color"
                    role="radiogroup"
                  >
                    {DRAWING_COLORS.map((color) => (
                      <button
                        key={color.value}
                        aria-checked={drawingColor === color.value}
                        aria-label={color.label}
                        className="relative flex size-11 touch-manipulation items-center justify-center rounded-full border border-foreground/30 ring-offset-background transition-[transform,box-shadow] duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 aria-checked:ring-2 aria-checked:ring-ring aria-checked:ring-offset-2"
                        onClick={() => setDrawingColor(color.value)}
                        role="radio"
                        style={{
                          backgroundColor: color.value,
                        }}
                        type="button"
                      >
                        {drawingColor === color.value && (
                          <Check
                            className="size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ))}
                    <button
                      aria-checked={isErasing}
                      aria-label="Eraser"
                      className="flex size-11 touch-manipulation items-center justify-center rounded-full border border-foreground/30 bg-white text-slate-900 ring-offset-background transition-[transform,box-shadow] duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 aria-checked:ring-2 aria-checked:ring-ring aria-checked:ring-offset-2"
                      onClick={() => setDrawingColor(ERASER_COLOR)}
                      role="radio"
                      type="button"
                    >
                      {isErasing ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : (
                        <Eraser className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  <div
                    className="flex items-center gap-1.5 border-l border-[#946440]/45 pl-3"
                    aria-label="Brush size"
                    role="radiogroup"
                  >
                    {BRUSH_SIZES.map((size) => (
                      <button
                        key={size.label}
                        aria-checked={brushSize === size.value}
                        aria-label={`${size.label} brush`}
                        className="flex size-11 touch-manipulation items-center justify-center rounded-lg border border-[#946440]/55 bg-[#bba88d]/30 text-[#2b1e12] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#bba88d]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-0 aria-checked:border-[#5d542b] aria-checked:bg-[#5d542b] aria-checked:text-[#f4ead7]"
                        onClick={() => setBrushSize(size.value)}
                        role="radio"
                        title={`${size.label} brush`}
                        type="button"
                      >
                        <span
                          className="rounded-full bg-current"
                          style={{
                            height: `${Math.max(4, Math.round(size.value * 300))}px`,
                            width: `${Math.max(4, Math.round(size.value * 300))}px`,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1">
            <DrawingCanvas
              brushSize={brushSize}
              color={drawingColor}
              disabled={
                roomSnapshot.phase === "active_round" && !isCurrentPlayerDrawer
              }
              isErasing={isErasing}
              onStroke={
                shouldSendDrawStrokes ? socket.sendDrawStroke : undefined
              }
              remoteStrokes={socket.drawStrokes}
              resetKey={canvasResetKey}
            />
          </CardContent>
        </Card>

        <Card className="order-3 min-h-0 max-h-[36rem] lg:max-h-none">
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
              ref={chatMessageListRef}
              data-testid="chat-message-list"
              className="flex min-h-[18rem] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg border bg-background/60 p-3 text-sm lg:min-h-0"
              aria-live="polite"
              onScroll={handleChatListScroll}
            >
              {socket.guessResults.map(({ id, result }) => (
                <p
                  key={`guess-result-${id}`}
                  className="status-enter rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 text-emerald-800 dark:text-emerald-200"
                >
                  <span className="font-medium">{result.display_name}</span>{" "}
                  guessed correctly (+{result.points_awarded} pts)
                </p>
              ))}
              {socket.messages.length === 0 && socket.guessResults.length === 0 ? (
                <p className="text-muted-foreground">
                  {roomSnapshot.phase === "active_round"
                    ? "Guesses and room activity will appear here."
                    : "No chat messages yet."}
                </p>
              ) : (
                socket.messages.map((message) => (
                  <p
                    key={message.id}
                    className="status-enter break-words whitespace-pre-wrap"
                  >
                    {message.text}
                  </p>
                ))
              )}
            </div>

            {unreadMessageCount > 0 && (
              <Button
                className="status-enter self-center"
                onClick={scrollChatToLatestMessage}
                size="sm"
                type="button"
                variant="outline"
              >
                {unreadMessageCount} new {unreadMessageCount === 1 ? "message" : "messages"}
              </Button>
            )}

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

      <FinalScoresOverlay finalScores={finalScores} status={finalScoresStatus} />
    </main>
  );
}

type BotLobbyControlsProps = {
  botProfiles: BotProfile[];
  errorMessage: string | null;
  onAdd: (botProfileId: string) => void;
  onRemove: (botProfileId: string) => void;
  onSelect: (botProfileId: string) => void;
  pendingBotProfileId: string | null;
  players: RoomPlayer[];
  selectedBotProfileId: string;
  status: "idle" | "loading" | "ready" | "failed";
};

function BotLobbyControls({
  botProfiles,
  errorMessage,
  onAdd,
  onRemove,
  onSelect,
  pendingBotProfileId,
  players,
  selectedBotProfileId,
  status,
}: BotLobbyControlsProps) {
  const roomBotIDs = new Set(
    players.filter((player) => player.principalType === "bot").map((player) => player.id),
  );
  const availableProfiles = botProfiles.filter((profile) => !roomBotIDs.has(profile.id));
  const roomBots = players.filter((player) => player.principalType === "bot");
  const isPending = pendingBotProfileId !== null;
  const selectedAvailableProfileId = availableProfiles.some(
    (profile) => profile.id === selectedBotProfileId,
  )
    ? selectedBotProfileId
    : (availableProfiles[0]?.id ?? "");

  return (
    <div className="space-y-2 border-t border-primary/15 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Bot players</p>
      <div className="flex gap-2">
        <select
          aria-label="Bot profile"
          className="min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
          disabled={status !== "ready" || isPending || availableProfiles.length === 0}
          onChange={(event) => onSelect(event.target.value)}
          value={selectedAvailableProfileId}
        >
          {availableProfiles.length === 0 ? (
            <option value="">No bots available</option>
          ) : (
            availableProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.difficulty})
              </option>
            ))
          )}
        </select>
        <Button
          disabled={isPending || selectedAvailableProfileId === "" || status !== "ready"}
          onClick={() => onAdd(selectedAvailableProfileId)}
          size="sm"
          type="button"
        >
          {pendingBotProfileId === selectedAvailableProfileId ? "Adding..." : "Add bot"}
        </Button>
      </div>
      {status === "loading" && <p className="text-xs text-muted-foreground">Loading bot profiles...</p>}
      {errorMessage !== null && <p className="text-xs text-destructive">{errorMessage}</p>}
      {roomBots.map((bot) => (
        <div key={bot.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{bot.displayName}</span>
          <Button
            disabled={isPending}
            onClick={() => onRemove(bot.id)}
            size="xs"
            type="button"
            variant="destructive"
          >
            {pendingBotProfileId === bot.id ? "Removing..." : "Remove"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function RoomSynchronizingPanel({
  socketStatus,
}: {
  socketStatus: RoomSocketStatus;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
      <section className="panel-enter flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border border-[#946440]/60 bg-[#2b1e12]/85 p-6 text-center text-[#f4ead7] shadow-[0_18px_42px_rgba(43,30,18,0.3)]">
        <div className="max-w-md">
          <LoaderCircle
            className="mx-auto size-9 animate-spin text-[#bba88d]"
            aria-hidden="true"
          />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.25em] text-[#d7bd89]">
            Entering the room
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Reading the room</h1>
          <p className="mt-3 text-sm leading-6 text-[#f4ead7]/85">
            Waiting for the fellowship, host, and game state to be confirmed.
          </p>
          {socketStatus === "failed" && (
            <p className="mt-4 text-sm font-medium text-[#f0c39b]">
              The room state could not be loaded. Re-enter the room to try
              again.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function useRoundTimer(roomSnapshot: RoomSnapshot): {
  label: string;
  remainingSeconds: number;
} | null {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);

  useEffect(() => {
    if (roomSnapshot.serverTime === null) {
      return;
    }

    const serverTimeMs = Date.parse(roomSnapshot.serverTime);

    if (Number.isNaN(serverTimeMs)) {
      return;
    }

    const updateOffset = window.setTimeout(() => {
      setServerClockOffsetMs(serverTimeMs - Date.now());
    }, 0);

    return () => window.clearTimeout(updateOffset);
  }, [roomSnapshot.serverTime]);

  useEffect(() => {
    if (
      roomSnapshot.phase !== "active_round" ||
      roomSnapshot.roundEndsAt === null
    ) {
      return;
    }

    const initialTick = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, [roomSnapshot.phase, roomSnapshot.roundEndsAt]);

  if (
    roomSnapshot.phase !== "active_round" ||
    roomSnapshot.roundEndsAt === null
  ) {
    return null;
  }

  const roundEndsAtMs = Date.parse(roomSnapshot.roundEndsAt);

  if (Number.isNaN(roundEndsAtMs)) {
    return null;
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil((roundEndsAtMs - (nowMs + serverClockOffsetMs)) / 1000),
  );

  return {
    label: formatRemainingTime(remainingSeconds),
    remainingSeconds,
  };
}

function MaskedWordDisplay({ word }: { word: string }) {
  const [previousWord, setPreviousWord] = useState(word);

  useEffect(() => {
    const updatePreviousWord = window.setTimeout(() => {
      setPreviousWord(word);
    }, 0);

    return () => window.clearTimeout(updatePreviousWord);
  }, [word]);

  return (
    <p
      className="max-w-full overflow-x-auto whitespace-pre rounded-lg border border-[#946440]/60 bg-[#bba88d]/35 px-3 py-2 font-mono text-sm font-semibold tracking-[0.18em] text-[#2b1e12] sm:tracking-[0.24em]"
      aria-label={`Masked word: ${word}`}
    >
      {Array.from(word).map((character, index) => {
        const isRevealedLetter = character !== "_" && character !== " ";
        const isNewlyRevealed =
          isRevealedLetter && previousWord[index] !== character;

        return (
          <span
            className={isNewlyRevealed ? "word-reveal inline-block" : "inline-block"}
            key={`${index}:${character}`}
          >
            {character === "_" ? "—" : character.toUpperCase()}
          </span>
        );
      })}
    </p>
  );
}

function formatRemainingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type RoundTransitionOverlayProps = {
  transition: {
    description: string;
    title: string;
    tone: "start" | "break";
  } | null;
};

function RoundTransitionOverlay({ transition }: RoundTransitionOverlayProps) {
  if (transition === null) {
    return null;
  }

  const isRoundStart = transition.tone === "start";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-[#2b1e12]/35 px-4 backdrop-blur-[2px] animate-in fade-in duration-300"
      role="status"
      aria-live="polite"
    >
      <div
        className={`panel-enter relative w-full max-w-lg overflow-hidden rounded-3xl border px-8 py-7 text-center shadow-2xl ${
          isRoundStart
            ? "border-[#bba88d]/70 bg-[#2b1e12]/95 text-[#f4ead7]"
            : "border-[#946440]/75 bg-[#bba88d]/95 text-[#2b1e12]"
        }`}
      >
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-50" />
        <div className="absolute -left-12 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-current/10 blur-2xl" />
        <div className="absolute -right-12 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-current/10 blur-2xl" />

        <div
          className={`relative mx-auto flex size-14 items-center justify-center rounded-full border ${
            isRoundStart
              ? "border-[#bba88d]/70 bg-[#5d542b]/60 text-[#f4ead7]"
              : "border-[#946440]/70 bg-[#2b1e12]/10 text-[#5d542b]"
          }`}
        >
          <Sparkles className="size-7 animate-pulse" aria-hidden="true" />
        </div>
        <p className="relative mt-5 text-xs font-bold uppercase tracking-[0.34em] opacity-80">
          {isRoundStart ? "New parchment" : "Interlude"}
        </p>
        <h2 className="relative mt-2 font-serif text-3xl font-bold sm:text-4xl">
          {transition.title}
        </h2>
        <p className="relative mt-3 text-sm font-medium opacity-85">
          {transition.description}
        </p>
        <div className="relative mt-6 h-px overflow-hidden bg-current/20">
          <span className="absolute inset-y-0 left-0 w-1/2 bg-current/80 motion-safe:animate-[hero-scan_2.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
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
        className="status-enter flex items-center gap-2 rounded-xl border border-[#bba88d]/55 bg-[#5d542b]/85 px-4 py-2 text-sm font-medium text-[#f4ead7] shadow-sm"
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
        className="status-enter flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
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
        className="status-enter flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
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
    <div className="min-w-0 rounded-xl border bg-background/60 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 truncate font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}

type PlayerCardProps = {
  player: RoomPlayer;
  rank: number;
};

function PlayerCard({ player, rank }: PlayerCardProps) {
  return (
    <div
      className="player-card-enter rounded-xl border bg-background/70 p-3 transition-[border-color,box-shadow] duration-200 hover:border-primary/40"
      style={{ "--player-index": rank - 1 } as CSSProperties}
    >
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
              key={player.score}
              className="score-pop inline-block text-xs font-semibold text-muted-foreground"
              aria-label={`${player.score} points`}
            >
              {player.score} pts
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {player.isHost && <PlayerBadge icon={Crown} label="Host" />}
            {player.isDrawer && <PlayerBadge icon={Palette} label="Drawer" />}
            <PlayerBadge
              icon={player.principalType === "bot" ? Bot : ShieldCheck}
              label={player.principalType === "bot" ? "Bot" : player.principalType}
            />
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
    <span className="status-enter inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
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
      <div className="status-enter rounded-xl border bg-background/70 p-3">
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
      <section className="panel-enter flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border bg-card/80 p-6 text-center shadow-sm">
        <div>
          <LoaderCircle className="parchment-spinner mx-auto size-8 text-primary" aria-hidden="true" />
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
      <section className="panel-enter flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-700 shadow-sm dark:text-amber-300">
        Word packs could not be loaded. Re-enter the room to retry.
      </section>
    );
  }

  if (wordPacks.length === 0) {
    return (
      <section className="panel-enter flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-700 shadow-sm dark:text-amber-300">
        No active word packs are available.
      </section>
    );
  }

  if (!isHost) {
    return (
      <section className="panel-enter flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border bg-card/80 p-6 text-center shadow-sm">
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
    <section className="panel-enter flex h-[calc(100vh-8rem)] min-h-[30rem] items-center justify-center rounded-3xl border bg-card/80 p-4 shadow-sm sm:p-6">
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
          {wordPacks.map((pack, index) => (
            <button
              className="panel-enter rounded-2xl border bg-background/70 p-4 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md active:translate-y-0 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_28%,transparent)]"
              key={pack.id}
              onClick={() => onSelect(pack.id)}
              type="button"
              aria-pressed={selectedWordPackId === pack.id}
              style={{ animationDelay: `${80 + index * 55}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{pack.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pack.description || pack.slug}
                  </p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                  {selectedWordPackId === pack.id ? "Chosen" : pack.slug}
                </span>
              </div>
            </button>
          ))}
        </div>

        <Button
          className="mt-6 w-full transition-transform active:translate-y-px"
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
      <div className="rounded-lg border border-[#bba88d]/55 bg-[#5d542b]/85 p-3 text-xs font-medium text-[#f4ead7] shadow-sm">
        Game start request accepted.
      </div>
    );
  }

  return null;
}

type FinalScoresStatusProps = {
  finalScores: ResolvedGameFinalScore[];
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm animate-in fade-in duration-300">
        <div
          aria-labelledby="final-scores-loading-title"
          aria-modal="true"
          className="panel-enter w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-2xl"
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm animate-in fade-in duration-300">
        <div
          aria-labelledby="final-scores-error-title"
          aria-modal="true"
          className="panel-enter w-full max-w-md rounded-3xl border border-amber-500/30 bg-card p-6 text-center shadow-2xl"
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
            <Link className={buttonVariants()} href="/play">
              Choose another room
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 py-6 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        aria-labelledby="final-scores-title"
        aria-modal="true"
        className="panel-enter relative flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
        role="dialog"
      >
        <Link
          aria-label="Leave completed room"
          className={`${buttonVariants({ variant: "secondary", size: "icon" })} absolute right-3 top-3 z-10 rounded-full`}
          href="/play"
        >
          <X className="size-4" aria-hidden="true" />
        </Link>
        <div className="relative overflow-hidden border-b bg-primary/10 px-6 py-7 text-center">
          <div className="absolute inset-x-8 top-0 h-24 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Trophy className="size-8 animate-pulse" aria-hidden="true" />
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
                  {remainingScores.map((score, index) => (
                    <ScoreRow key={score.id} score={score} index={index} />
                  ))}
                </div>
              )}
            </>
          )}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Link className={buttonVariants()} href="/play">
              Choose another room
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScorePodiumCard({ score }: { score: ResolvedGameFinalScore }) {
  const revealDelay = Math.max(0, 3 - score.final_rank) * 160 + 120;

  return (
    <div
      className={`panel-enter rounded-2xl border p-4 text-center ${
        score.is_winner
          ? "border-amber-500/40 bg-amber-500/10"
          : "bg-background/70"
      }`}
      style={{ animationDelay: `${revealDelay}ms` }}
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

function ScoreRow({
  index,
  score,
}: {
  index: number;
  score: ResolvedGameFinalScore;
}) {
  return (
    <div
      className="panel-enter flex items-center gap-3 rounded-xl border bg-background/70 p-3"
      style={{ animationDelay: `${560 + index * 70}ms` }}
    >
      <span className="w-8 text-center text-sm font-bold text-muted-foreground">
        #{score.final_rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {finalScoreDisplayName(score)}
        </p>
        <p className="text-xs text-muted-foreground">
          {score.principal?.type === "user" ? "Registered player" : "Guest"}
        </p>
      </div>
      <p className="font-bold tabular-nums">{score.final_score} pts</p>
    </div>
  );
}

function finalScoreDisplayName(score: ResolvedGameFinalScore): string {
  return (
    score.principal?.display_name ??
    `Participant ${shortParticipantId(score.participant_id)}`
  );
}

function shortParticipantId(participantId: string): string {
  return participantId.slice(0, 8);
}
