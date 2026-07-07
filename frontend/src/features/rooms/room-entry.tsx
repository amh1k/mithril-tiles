"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, DoorOpen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
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
    router.push(`/room/${roomCode}`);
  }

  const joinRoom = handleSubmit(({ room_code: roomCode }) => {
    enterRoom(roomCode);
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8">
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
        <Card>
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
              className="h-11 w-full"
              onClick={() => enterRoom(generateRoomCode())}
              type="button"
            >
              Create room
              <ArrowRight aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        <Card>
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
                  disabled={isSubmitting}
                  {...register("room_code")}
                />
                {errors.room_code && (
                  <p
                    id="room-code-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.room_code.message}
                  </p>
                )}
              </div>

              <Button
                className="h-11 w-full"
                disabled={isSubmitting}
                type="submit"
                variant="outline"
              >
                Join room
                <ArrowRight aria-hidden="true" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
