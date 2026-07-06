import "server-only";

import { z } from "zod";

const httpUrl = z
  .url()
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "must use http:// or https://",
  );

const serverEnvSchema = z.object({
  BACKEND_API_URL: httpUrl,
  APP_ORIGIN: httpUrl,
});

export const serverEnv = serverEnvSchema.parse({
  BACKEND_API_URL: process.env.BACKEND_API_URL,
  APP_ORIGIN: process.env.APP_ORIGIN,
});
