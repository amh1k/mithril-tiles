import { z } from "zod";

export const gameFinalScoreSchema = z.object({
  created_at: z.iso.datetime({ offset: true }),
  final_rank: z.number().int().positive(),
  final_score: z.number().int(),
  game_id: z.uuid(),
  id: z.uuid(),
  is_winner: z.boolean(),
  participant_id: z.uuid(),
});

export const finalScoresResponseSchema = z.object({
  game_final_scores: z.array(gameFinalScoreSchema),
});

export const backendFinalScoresResponseSchema = z
  .object({
    "game-final-score": z.array(gameFinalScoreSchema),
  })
  .transform((response) => ({
    game_final_scores: response["game-final-score"],
  }));

export type GameFinalScore = z.infer<typeof gameFinalScoreSchema>;
export type FinalScoresResponse = z.infer<typeof finalScoresResponseSchema>;

export async function fetchFinalScores(
  gameId: string,
  signal?: AbortSignal,
): Promise<FinalScoresResponse> {
  const response = await fetch(
    `/api/games/${encodeURIComponent(gameId)}/final-scores`,
    {
      cache: "no-store",
      credentials: "same-origin",
      method: "GET",
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Final scores could not be loaded.");
  }

  const parsedResponse = finalScoresResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );

  if (!parsedResponse.success) {
    throw new Error("Final scores response was invalid.");
  }

  return parsedResponse.data;
}
