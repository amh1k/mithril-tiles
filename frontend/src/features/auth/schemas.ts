import { z } from "zod";
const byteLength = (value: string) => new TextEncoder().encode(value).length;
const displayNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "Display name is required")
  .refine((value) => byteLength(value) >= 3, "Display name is too short")
  .refine(
    (value) => byteLength(value) <= 60,
    "Display name must not exceed 60 bytes",
  );
const handleSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "Handle is required")
  .refine((value) => byteLength(value) >= 3, "Handle is too short")
  .refine(
    (value) => byteLength(value) <= 60,
    "Handle must not exceed 60 bytes",
  );

const passwordSchema = z
  .string()
  .refine(
    (value) => byteLength(value) >= 8,
    "Password must be at least 8 bytes",
  )
  .refine(
    (value) => byteLength(value) <= 72,
    "Password must not exceed 72 bytes",
  );

export const registerRequestSchema = z
  .object({
    display_name: displayNameSchema,
    handle: handleSchema,
    email: z.email("Enter a valid email address"),
    password: passwordSchema,
    avatar_url: z.string(),
  })
  .strict();

export const registerFormSchema = registerRequestSchema
  .omit({ avatar_url: true })
  .extend({
    password_confirmation: z
      .string()
      .min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
  });

export const loginRequestSchema = z
  .object({
    email: z.email("Enter a valid email address"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const guestRequestSchema = z
  .object({
    display_name: displayNameSchema,
  })
  .strict();

export const authenticationTokenSchema = z.object({
  token: z.string().min(1),
  expiry: z.iso.datetime({ offset: true }),
});

export const userSchema = z.object({
  id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  display_name: z.string(),
  account_status: z.string(),
  handle: z.string(),
  email: z.email(),
  activated: z.boolean(),
  avatar_url: z.string(),
});

export const guestSessionSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

export const userAuthResponseSchema = z.object({
  user: userSchema,
  authentication_token: authenticationTokenSchema,
});

export const guestAuthResponseSchema = z.object({
  guest_session: guestSessionSchema,
  authentication_token: authenticationTokenSchema,
});

export const userPrincipalSchema = z.object({
  type: z.literal("user"),
  id: z.uuid(),
  display_name: z.string(),
  handle: z.string(),
  avatar_url: z.string(),
});
export const guestPrincipalSchema = z.object({
  type: z.literal("guest"),
  id: z.uuid(),
  display_name: z.string(),
});
export const principalSchema = z.discriminatedUnion("type", [
  userPrincipalSchema,
  guestPrincipalSchema,
]);
export const authSessionResponseSchema = z.object({
  principal: principalSchema,
});

export const guestSessionResponseSchema = z.object({
  principal: guestPrincipalSchema,
});

export const userSessionResponseSchema = z.object({
  principal: userPrincipalSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type GuestRequest = z.infer<typeof guestRequestSchema>;
export type AuthenticationToken = z.infer<typeof authenticationTokenSchema>;
export type User = z.infer<typeof userSchema>;
export type GuestSession = z.infer<typeof guestSessionSchema>;
export type UserAuthResponse = z.infer<typeof userAuthResponseSchema>;
export type GuestAuthResponse = z.infer<typeof guestAuthResponseSchema>;
export type Principal = z.infer<typeof principalSchema>;
export type GuestPrincipal = z.infer<typeof guestPrincipalSchema>;
export type UserPrincipal = z.infer<typeof userPrincipalSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
