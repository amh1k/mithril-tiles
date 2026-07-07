import { z } from "zod";

export const startGameRequestSchema = z.object({
  word_pack_id: z.uuid(),
});

const backendDateTimeSchema = z.string().min(1);

const gameSchema = z.object({
  id: z.uuid(),
  room_code: z.string(),
  host_participant_id: z.uuid(),
  word_pack_id: z.uuid(),
  status: z.string(),
  settings_snapshot: z.unknown(),
  started_at: backendDateTimeSchema,
  ended_at: backendDateTimeSchema.nullable().optional(),
  created_at: backendDateTimeSchema.optional(),
});

const gameParticipantSchema = z.object({
  id: z.uuid(),
  game_id: z.uuid(),
  user_id: z.uuid().nullable().optional(),
  guest_session_id: z.uuid().nullable().optional(),
  bot_profile_id: z.uuid().nullable().optional(),
  display_name_snapshot: z.string(),
  participant_type: z.string().optional(),
  is_host: z.boolean(),
  joined_at: backendDateTimeSchema,
  left_at: backendDateTimeSchema.nullable().optional(),
});

const gameRoundSchema = z.object({
  id: z.uuid(),
  game_id: z.uuid(),
  round_number: z.number().int(),
  drawer_participant_id: z.uuid(),
  word_id: z.uuid(),
  word_text_snapshot: z.string(),
  status: z.string(),
  duration_seconds: z.number().int(),
  started_at: backendDateTimeSchema,
  ended_at: backendDateTimeSchema.nullable().optional(),
});

export const startGameResponseSchema = z.object({
  game: gameSchema,
  game_participants: z.array(gameParticipantSchema),
  round: gameRoundSchema,
});

export type StartGameRequest = z.infer<typeof startGameRequestSchema>;
export type StartGameResponse = z.infer<typeof startGameResponseSchema>;
