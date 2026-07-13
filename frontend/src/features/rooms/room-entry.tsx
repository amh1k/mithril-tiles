"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, DoorOpen, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateRoomCode,
  joinRoomFormSchema,
  type JoinRoomFormInput,
  type JoinRoomFormValues,
  type RoomCode,
} from "./room-code";

type RoomEntryProps = {
  displayName: string;
};

export function RoomEntry({ displayName }: RoomEntryProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<JoinRoomFormInput, unknown, JoinRoomFormValues>({
    resolver: zodResolver(joinRoomFormSchema),
    defaultValues: {
      room_code: "",
    },
  });

  function enterRoom(roomCode: RoomCode) {
    if (isNavigating) {
      return;
    }

    setIsNavigating(true);
    router.push(`/room/${roomCode}`);
  }

  const joinRoom = handleSubmit(({ room_code: roomCode }) => {
    enterRoom(roomCode);
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8 panel-enter">
        <p className="text-sm font-medium text-muted-foreground">
          Signed in as {displayName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Choose your room
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Open a fresh room for your group or enter the code shared by a
          friend.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="panel-enter [animation-delay:80ms]">
          <CardHeader>
            <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary">
              <Plus className="size-5" aria-hidden="true" />
            </span>
            <CardTitle>Create a room</CardTitle>
            <CardDescription>
              Generate a private room code and become the first player in the
              lobby.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="h-11 w-full transition-transform active:translate-y-px"
              disabled={isNavigating}
              onClick={() => enterRoom(generateRoomCode())}
              type="button"
            >
              {isNavigating ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Entering room…
                </>
              ) : (
                <>
                  Create room
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="panel-enter [animation-delay:150ms]">
          <CardHeader>
            <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary">
              <DoorOpen className="size-5" aria-hidden="true" />
            </span>
            <CardTitle>Join a room</CardTitle>
            <CardDescription>
              Enter a room code. Spaces, hyphens, and letter case are
              normalized automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={joinRoom} noValidate>
              <div className="space-y-2">
                <Label htmlFor="room-code">Room code</Label>
                <Input
                  id="room-code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="h-11 uppercase"
                  placeholder="ROOM01"
                  aria-describedby={
                    errors.room_code ? "room-code-error" : undefined
                  }
                  aria-invalid={errors.room_code ? true : undefined}
                  disabled={isSubmitting || isNavigating}
                  {...register("room_code")}
                />
                {errors.room_code && (
                  <p
                    id="room-code-error"
                    className="field-error-enter text-sm text-destructive"
                    role="alert"
                  >
                    {errors.room_code.message}
                  </p>
                )}
              </div>

              <Button
                className="h-11 w-full transition-transform active:translate-y-px"
                disabled={isSubmitting || isNavigating}
                aria-busy={isNavigating}
                type="submit"
                variant="outline"
              >
                {isNavigating ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    Entering room…
                  </>
                ) : (
                  <>
                    Join room
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
