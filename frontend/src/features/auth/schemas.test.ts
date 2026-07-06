import { describe, expect, it } from "vitest";

import {
  guestAuthResponseSchema,
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
});
