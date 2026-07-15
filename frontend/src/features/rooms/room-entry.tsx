"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CircleCheck,
  DoorOpen,
  LoaderCircle,
  Plus,
} from "lucide-react";
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
    <main className="relative isolate flex w-full flex-1 items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[34rem] w-[56rem] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#946440]/10 blur-[90px]" aria-hidden="true" />

      <section className="w-full max-w-5xl">
        <div className="panel-enter mb-9 text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-[#946440]/45 bg-[#2b1e12]/75 px-3.5 py-1.5 text-xs font-semibold text-[#cdbb9f] shadow-sm">
            <CircleCheck className="size-3.5 text-[#8f8d4b]" aria-hidden="true" />
            Signed in as <span className="max-w-40 truncate text-[#f4ead7]">{displayName}</span>
          </div>
          <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight text-[#2b1e12] sm:text-4xl">
            Choose your passage
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-[#2b1e12] sm:text-base">
            Raise a new banner for your company or follow a room code into a
            gathering already underway.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="panel-enter group overflow-hidden border-[#5d542b]/60 bg-[#bba88d] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#5d542b] hover:shadow-[0_22px_55px_rgba(43,30,18,0.2)] [animation-delay:80ms]">
          <CardHeader className="pb-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="flex size-12 items-center justify-center rounded-full border border-[#5d542b]/40 bg-[#2b1e12] text-[#e4d4bc] shadow-[0_8px_20px_rgba(43,30,18,0.25)] transition-transform duration-200 group-hover:scale-105">
                <Plus className="size-5" aria-hidden="true" />
              </span>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[#946440]">New company</span>
            </div>
            <CardTitle className="text-2xl text-[#2b1e12]">Create a room</CardTitle>
            <CardDescription className="min-h-12 leading-6 text-[#5d542b]">
              Generate a private room code and become the first player in the
              lobby.
            </CardDescription>
          </CardHeader>
          <CardContent className="border-t border-[#946440]/30 pt-5">
            <Button
              className="h-12 w-full bg-[#5d542b] text-[#f4ead7] transition-transform hover:bg-[#6e6c34] active:translate-y-px"
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

          <Card className="panel-enter group overflow-hidden border-[#946440]/65 bg-[#d0bda1] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#5d542b] hover:shadow-[0_22px_55px_rgba(43,30,18,0.2)] [animation-delay:150ms]">
          <CardHeader className="pb-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="flex size-12 items-center justify-center rounded-full border border-[#5d542b]/40 bg-[#946440] text-[#2b1e12] shadow-[0_8px_20px_rgba(43,30,18,0.18)] transition-transform duration-200 group-hover:scale-105">
                <DoorOpen className="size-5" aria-hidden="true" />
              </span>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[#946440]">Known passage</span>
            </div>
            <CardTitle className="text-2xl text-[#2b1e12]">Join a room</CardTitle>
            <CardDescription className="min-h-12 leading-6 text-[#5d542b]">
              Enter a room code. Spaces, hyphens, and letter case are
              normalized automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="border-t border-[#946440]/30 pt-5">
            <form className="space-y-4" onSubmit={joinRoom} noValidate>
              <div className="space-y-2">
                <Label className="font-bold text-[#2b1e12]" htmlFor="room-code">
                  Room code
                </Label>
                <Input
                  id="room-code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="h-12 border-[#5d3d27]/75 bg-[#f3e3c8] text-center font-heading text-base font-bold tracking-[0.2em] text-[#24170f] uppercase caret-[#5d3d27] selection:bg-[#946440]/35 placeholder:text-[#7b6248] placeholder:tracking-[0.2em] focus-visible:border-[#5d3d27] focus-visible:ring-[#946440]/35 disabled:bg-[#d8c4a5] disabled:text-[#5d4a38] dark:bg-[#f3e3c8] dark:text-[#24170f] dark:placeholder:text-[#7b6248] dark:disabled:bg-[#d8c4a5]"
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
                className="h-12 w-full border-[#5d542b]/60 bg-transparent text-[#2b1e12] transition-transform hover:bg-[#5d542b] hover:text-[#f4ead7] active:translate-y-px"
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
      </section>
    </main>
  );
}
