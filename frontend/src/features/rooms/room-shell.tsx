"use client";

import {
  Clock,
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
import { useRoomSocket } from "@/features/realtime/use-room-socket";
import type { RoomCode } from "@/features/rooms/room-code";

type RoomShellProps = {
  principal: Principal;
  roomCode: RoomCode;
};

export function RoomShell({ principal, roomCode }: RoomShellProps) {
  const socket = useRoomSocket({ roomCode });
  const [chatMessage, setChatMessage] = useState("");

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

      <section className="grid min-h-[34rem] gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <Card>
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

        <Card className="min-h-[28rem]">
          <CardHeader>
            <CardTitle>Canvas</CardTitle>
            <CardDescription>
              The drawing surface will mount here after the realtime connection
              is in place.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1">
            <div className="flex min-h-[22rem] flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/30 text-center text-sm text-muted-foreground">
              Canvas placeholder
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chat & guesses</CardTitle>
            <CardDescription>
              Messages and system activity will stream here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-[24rem] flex-col gap-3">
            <div
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border bg-background/60 p-3 text-sm"
              aria-live="polite"
            >
              {socket.messages.length === 0 ? (
                <p className="text-muted-foreground">
                  No chat messages yet.
                </p>
              ) : (
                socket.messages.map((message) => (
                  <p key={message.id} className="whitespace-pre-wrap">
                    {message.text}
                  </p>
                ))
              )}
            </div>

            <form
              className="flex gap-2"
              onSubmit={handleSendChatMessage}
            >
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
                  socket.status !== "connected" ||
                  chatMessage.trim() === ""
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
