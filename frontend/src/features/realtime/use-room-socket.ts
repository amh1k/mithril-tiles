"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  parseRoomSocketMessage,
  type DrawStroke,
  type RealtimeRoomSnapshot,
} from "@/features/realtime/protocol";
import type { RoomCode } from "@/features/rooms/room-code";
import { websocketTicketResponseSchema } from "@/features/rooms/tickets";
import { clientEnv } from "@/lib/env/client";

export type RoomSocketStatus =
  | "idle"
  | "requesting_ticket"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "failed";

type RoomSocketState = {
  drawStrokes: RoomDrawStroke[];
  errorMessage?: string;
  gameEndedAt: number | null;
  messages: RoomChatMessage[];
  retryAttempt: number;
  roomSnapshot: RealtimeRoomSnapshot | null;
  status: RoomSocketStatus;
};

type RoomSocketResult = RoomSocketState & {
  sendChatMessage: (message: string) => boolean;
  sendDrawStroke: (stroke: DrawStroke) => boolean;
};

export type RoomChatMessage = {
  id: number;
  text: string;
};

export type RoomDrawStroke = {
  id: number;
  stroke: DrawStroke;
};

type UseRoomSocketOptions = {
  roomCode: RoomCode;
  maxRetries?: number;
};

const DEFAULT_MAX_RETRIES = 3;
const MAX_CHAT_MESSAGES = 100;
const MAX_DRAW_STROKES = 2_000;

export function useRoomSocket({
  roomCode,
  maxRetries = DEFAULT_MAX_RETRIES,
}: UseRoomSocketOptions): RoomSocketResult {
  const socketRef = useRef<WebSocket | null>(null);
  const nextMessageIdRef = useRef(1);
  const nextStrokeIdRef = useRef(1);
  const ticketEndpoint = useMemo(
    () => `/api/rooms/${encodeURIComponent(roomCode)}/ticket`,
    [roomCode],
  );
  const sendChatMessage = useCallback((message: string) => {
    const trimmedMessage = message.trim();
    const socket = socketRef.current;

    if (
      trimmedMessage === "" ||
      socket === null ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return false;
    }

    socket.send(
      JSON.stringify({
        type: "chat_message",
        data: trimmedMessage,
      }),
    );

    return true;
  }, []);
  const sendDrawStroke = useCallback((stroke: DrawStroke) => {
    const socket = socketRef.current;

    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(createDrawStrokeMessage(stroke));
    return true;
  }, []);
  const [state, setState] = useState<RoomSocketState>({
    drawStrokes: [],
    gameEndedAt: null,
    messages: [],
    retryAttempt: 0,
    roomSnapshot: null,
    status: "idle",
  });

  useEffect(() => {
    const abortController = new AbortController();
    let closedByEffect = false;
    let activeConnectionId = 0;
    let consecutiveFailures = 0;
    let connectionInProgress = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function connect(retryAttempt: number) {
      if (
        closedByEffect ||
        connectionInProgress ||
        socketRef.current !== null
      ) {
        return;
      }

      connectionInProgress = true;
      const connectionId = ++activeConnectionId;

      setState((currentState) => ({
        ...currentState,
        retryAttempt,
        status: retryAttempt === 0 ? "requesting_ticket" : "reconnecting",
      }));

      let ticket: string;

      try {
        ticket = await requestRoomTicket(
          ticketEndpoint,
          abortController.signal,
        );
      } catch (error) {
        connectionInProgress = false;

        if (abortController.signal.aborted) {
          return;
        }

        scheduleReconnect(
          error instanceof Error
            ? error.message
            : "The realtime ticket request failed.",
        );
        return;
      }

      if (abortController.signal.aborted) {
        connectionInProgress = false;
        return;
      }

      setState((currentState) => ({
        ...currentState,
        retryAttempt,
        status: "connecting",
      }));

      const socket = new WebSocket(createRoomSocketUrl(roomCode, ticket));
      socketRef.current = socket;
      connectionInProgress = false;

      socket.addEventListener("open", () => {
        if (closedByEffect || connectionId !== activeConnectionId) {
          return;
        }

        consecutiveFailures = 0;
        setState((currentState) => ({
          ...currentState,
          errorMessage: undefined,
          retryAttempt: 0,
          status: "connected",
        }));
      });

      socket.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (closedByEffect || connectionId !== activeConnectionId) {
          return;
        }

        const parsedMessage = parseRoomSocketMessage(event.data);

        if (parsedMessage.type === "legacy_text") {
          setState((currentState) => ({
            ...currentState,
            messages: appendBoundedMessage(currentState.messages, {
              id: nextMessageIdRef.current++,
              text: parsedMessage.text,
            }),
          }));
          return;
        }

        if (parsedMessage.type === "game_ended") {
          setState((currentState) => ({
            ...currentState,
            gameEndedAt: Date.now(),
            messages: appendBoundedMessage(currentState.messages, {
              id: nextMessageIdRef.current++,
              text: parsedMessage.text,
            }),
          }));
          return;
        }

        if (parsedMessage.type === "draw_stroke") {
          setState((currentState) => ({
            ...currentState,
            drawStrokes: appendBoundedStroke(currentState.drawStrokes, {
              id: nextStrokeIdRef.current++,
              stroke: parsedMessage.stroke,
            }),
          }));
          return;
        }

        if (parsedMessage.type === "room_snapshot") {
          setState((currentState) => ({
            ...currentState,
            roomSnapshot: parsedMessage.snapshot,
          }));
        }
      });

      socket.addEventListener("close", () => {
        if (closedByEffect || connectionId !== activeConnectionId) {
          return;
        }

        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        activeConnectionId++;
        scheduleReconnect("The realtime connection closed unexpectedly.");
      });

      socket.addEventListener("error", () => {
        if (closedByEffect || connectionId !== activeConnectionId) {
          return;
        }

        socket.close();
      });
    }

    function scheduleReconnect(errorMessage: string) {
      if (retryTimer !== undefined || closedByEffect) {
        return;
      }

      if (!navigator.onLine) {
        setState((currentState) => ({
          ...currentState,
          errorMessage:
            "You are offline. Reconnection will resume when online.",
          status: "reconnecting",
        }));
        return;
      }

      if (consecutiveFailures >= maxRetries) {
        setState((currentState) => ({
          ...currentState,
          errorMessage,
          retryAttempt: consecutiveFailures,
          status: "failed",
        }));
        return;
      }

      consecutiveFailures++;

      setState((currentState) => ({
        ...currentState,
        errorMessage,
        retryAttempt: consecutiveFailures,
        status: "reconnecting",
      }));

      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void connect(consecutiveFailures);
      }, reconnectDelayMs(consecutiveFailures));
    }

    function handleOffline() {
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }

      setState((currentState) => ({
        ...currentState,
        errorMessage: "You are offline. Reconnection will resume when online.",
        status: "reconnecting",
      }));
    }

    function handleOnline() {
      if (
        closedByEffect ||
        retryTimer !== undefined ||
        connectionInProgress ||
        socketRef.current !== null
      ) {
        return;
      }

      void connect(consecutiveFailures);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    void connect(0);

    return () => {
      closedByEffect = true;
      abortController.abort();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);

      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
      }

      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [maxRetries, roomCode, sendChatMessage, sendDrawStroke, ticketEndpoint]);

  return {
    ...state,
    sendChatMessage,
    sendDrawStroke,
  };
}

export function createDrawStrokeMessage(stroke: DrawStroke): string {
  return JSON.stringify({
    type: "draw_stroke",
    data: stroke,
  });
}

async function requestRoomTicket(
  ticketEndpoint: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(ticketEndpoint, {
    cache: "no-store",
    credentials: "same-origin",
    method: "POST",
    signal,
  });

  if (!response.ok) {
    throw new Error("The realtime ticket request was rejected.");
  }

  const parsedResponse = websocketTicketResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );

  if (!parsedResponse.success) {
    throw new Error("The realtime ticket response was invalid.");
  }

  return parsedResponse.data.websocket_ticket.ticket;
}

function createRoomSocketUrl(roomCode: RoomCode, ticket: string): string {
  const url = new URL(
    `/v1/rooms/${encodeURIComponent(roomCode)}/ws`,
    clientEnv.NEXT_PUBLIC_BACKEND_WS_URL,
  );
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

function reconnectDelayMs(retryAttempt: number): number {
  const baseDelayMs = Math.min(1_000 * 2 ** (retryAttempt - 1), 8_000);
  const jitterMs = Math.floor(Math.random() * 250);
  return baseDelayMs + jitterMs;
}

function appendBoundedMessage(
  messages: RoomChatMessage[],
  message: RoomChatMessage,
): RoomChatMessage[] {
  return [...messages, message].slice(-MAX_CHAT_MESSAGES);
}

function appendBoundedStroke(
  strokes: RoomDrawStroke[],
  stroke: RoomDrawStroke,
): RoomDrawStroke[] {
  return [...strokes, stroke].slice(-MAX_DRAW_STROKES);
}
