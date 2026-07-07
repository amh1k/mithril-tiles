import { z } from "zod";

export const wordPackSchema = z.object({
  created_at: z.iso.datetime({ offset: true }),
  description: z.string(),
  id: z.uuid(),
  is_active: z.boolean(),
  name: z.string(),
  slug: z.string(),
  updated_at: z.iso.datetime({ offset: true }),
});

export const wordPackResponseSchema = z.object({
  word_pack: wordPackSchema,
});

export const backendGetWordPackResponseSchema = z
  .union([
    wordPackResponseSchema,
    z.object({
      "word-pack": wordPackSchema,
    }),
  ])
  .transform((response) => ({
    word_pack:
      "word_pack" in response ? response.word_pack : response["word-pack"],
  }));

export type WordPack = z.infer<typeof wordPackSchema>;
export type WordPackResponse = z.infer<typeof wordPackResponseSchema>;
