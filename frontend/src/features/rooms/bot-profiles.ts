import { z } from "zod";

import type { RoomCode } from "@/features/rooms/room-code";
import { frontendApiErrorSchema } from "@/lib/api/errors";

export const botProfileSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  difficulty: z.string().min(1),
  behavior_style: z.string().min(1),
  avatar_url: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export const botProfilesResponseSchema = z.object({
  bot_profiles: z.array(botProfileSchema),
});

export const botProfileMutationSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    difficulty: z.enum(["easy", "normal", "hard", "custom"]),
    behavior_style: z
      .string()
      .trim()
      .min(1, "Behavior style is required")
      .max(100),
    avatar_url: z.string().trim().url("Avatar URL must be valid").nullable(),
    is_active: z.boolean(),
  })
  .strict();

const botMutationRequestSchema = z.object({
  id: z.uuid(),
});

export type BotProfile = z.infer<typeof botProfileSchema>;
export type BotProfileMutation = z.infer<typeof botProfileMutationSchema>;

export async function fetchActiveBotProfiles(
  signal?: AbortSignal,
): Promise<BotProfile[]> {
  const response = await fetch("/api/bot-profiles", {
    cache: "no-store",
    credentials: "same-origin",
    method: "GET",
    signal,
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const parsed = botProfilesResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  if (!parsed.success) {
    throw new Error("The available bot profiles response was invalid.");
  }
  return parsed.data.bot_profiles;
}

export async function addBotToRoom(roomCode: RoomCode, id: string): Promise<void> {
  await mutateRoomBot(roomCode, id, "POST");
}

export async function removeBotFromRoom(
  roomCode: RoomCode,
  id: string,
): Promise<void> {
  await mutateRoomBot(roomCode, id, "DELETE");
}

async function mutateRoomBot(
  roomCode: RoomCode,
  id: string,
  method: "POST" | "DELETE",
): Promise<void> {
  const parsedRequest = botMutationRequestSchema.safeParse({ id });
  if (!parsedRequest.success) {
    throw new Error("The selected bot profile is invalid.");
  }

  const response = await fetch(
    `/api/rooms/${encodeURIComponent(roomCode)}/bots`,
    {
      body: JSON.stringify(parsedRequest.data),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method,
    },
  );
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }
}

async function responseErrorMessage(response: Response): Promise<string> {
  const parsed = frontendApiErrorSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  return parsed.success ? parsed.data.message : "The bot request failed.";
}
