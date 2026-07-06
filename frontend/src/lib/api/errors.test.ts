import { describe, expect, it } from "vitest";

import { normalizeBackendError } from "./errors";

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
