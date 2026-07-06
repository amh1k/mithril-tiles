import { describe, expect, it } from "vitest";

import {
  hasJsonContentType,
  hasTrustedMutationOrigin,
} from "./mutation-request";

describe("mutation request security", () => {
  it("accepts JSON with an optional charset", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });

    expect(hasJsonContentType(request)).toBe(true);
  });

  it("rejects non-JSON content", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: {
        "Content-Type": "text/plain",
      },
    });

    expect(hasJsonContentType(request)).toBe(false);
  });

  it("accepts the configured application origin", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: {
        Origin: "https://play.example.com",
      },
    });

    expect(
      hasTrustedMutationOrigin(
        request,
        "https://play.example.com",
        true,
      ),
    ).toBe(true);
  });

  it("rejects a different origin", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: {
        Origin: "https://attacker.example",
      },
    });

    expect(
      hasTrustedMutationOrigin(
        request,
        "https://play.example.com",
        true,
      ),
    ).toBe(false);
  });

  it("rejects a missing origin when one is required", () => {
    const request = new Request("http://localhost/api/auth/login");

    expect(
      hasTrustedMutationOrigin(
        request,
        "https://play.example.com",
        true,
      ),
    ).toBe(false);
  });
});
