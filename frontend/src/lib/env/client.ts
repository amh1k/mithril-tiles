import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_BACKEND_WS_URL: z
    .url()
    .refine(
      (value) => ["ws:", "wss:"].includes(new URL(value).protocol),
      "NEXT_PUBLIC_BACKEND_WS_URL must use ws:// or wss://",
    ),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_BACKEND_WS_URL: process.env.NEXT_PUBLIC_BACKEND_WS_URL,
});
