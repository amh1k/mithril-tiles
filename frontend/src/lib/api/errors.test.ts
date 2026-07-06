import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  normalizeBackendError,
  normalizeValidationError,
} from "./errors";

describe("normalizeBackendError", () => {
  it("normalizes backend validation errors", async () => {
    const response = Response.json(
      {
        error: {
          email: "must be a valid email address",
        },
      },
      { status: 422 },
    );

    await expect(normalizeBackendError(response)).resolves.toEqual({
      status: 422,
      code: "validation_failed",
      message: "One or more fields are invalid.",
      fieldErrors: {
        email: "must be a valid email address",
      },
    });
  });
});

describe("normalizeValidationError", () => {
  it("keeps the first validation message for each field", () => {
    const result = z
      .object({
        display_name: z.string().min(3).regex(/^player/),
      })
      .safeParse({ display_name: "" });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(normalizeValidationError(result.error)).toEqual({
      status: 422,
      code: "validation_failed",
      message: "One or more fields are invalid.",
      fieldErrors: {
        display_name: "Too small: expected string to have >=3 characters",
      },
    });
  });
});
