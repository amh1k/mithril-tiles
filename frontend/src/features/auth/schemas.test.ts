import { describe, expect, it } from "vitest";

import {
  authSessionResponseSchema,
  guestAuthResponseSchema,
  registerFormSchema,
  registerRequestSchema,
} from "./schemas";

describe("authentication schemas", () => {
  it("accepts the current guest authentication response", () => {
    const response = {
      guest_session: {
        id: "1a34b2da-1280-4f70-aeca-08c8f34426c6",
        display_name: "Guest One",
        created_at: "2026-07-06T05:30:00Z",
      },
      authentication_token: {
        token: "opaque-token",
        expiry: "2026-07-09T05:30:00Z",
      },
    };

    expect(guestAuthResponseSchema.parse(response)).toEqual(response);
  });

  it("enforces the backend's byte limit for display names", () => {
    const request = {
      display_name: "界".repeat(21),
      handle: "player-one",
      email: "player@example.com",
      password: "password",
      avatar_url: "",
    };

    const result = registerRequestSchema.safeParse(request);

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) =>
        issue.message.includes("must not exceed 60 bytes"),
      ),
    ).toBe(true);
  });

  it("requires matching registration passwords", () => {
    const result = registerFormSchema.safeParse({
      display_name: "Player One",
      handle: "player-one",
      email: "player@example.com",
      password: "password-one",
      password_confirmation: "password-two",
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.flatten().fieldErrors.password_confirmation).toEqual([
      "Passwords do not match",
    ]);
  });

  it("accepts a registered session without an avatar URL", () => {
    const response = {
      principal: {
        type: "user",
        id: "1a34b2da-1280-4f70-aeca-08c8f34426c6",
        display_name: "Player One",
        handle: "player-one",
      },
    };

    expect(authSessionResponseSchema.parse(response)).toEqual(response);
  });
});
