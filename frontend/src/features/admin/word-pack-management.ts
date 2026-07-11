import { z } from "zod";

export const wordPackMutationSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    slug: z
      .string()
      .trim()
      .min(1, "Slug is required")
      .max(100)
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and single hyphens only",
      ),
    description: z
      .string()
      .max(500, "Description must not exceed 500 characters"),
    is_active: z.boolean(),
  })
  .strict();

export type WordPackMutation = z.infer<typeof wordPackMutationSchema>;

export const wordMutationSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Word is required")
      .max(100, "Word must not exceed 100 characters"),
    difficulty: z.enum(["easy", "medium", "hard"]),
  })
  .strict();

export const wordResponseSchema = z.object({
  word: z.object({
    created_at: z.iso.datetime({ offset: true }),
    difficulty: z.enum(["easy", "medium", "hard"]),
    id: z.uuid(),
    text: z.string(),
    word_pack_id: z.uuid(),
  }),
});

export type WordMutation = z.infer<typeof wordMutationSchema>;
