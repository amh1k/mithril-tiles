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
