import "server-only";

import { redirect } from "next/navigation";

import {
  authSessionResponseSchema,
  type Principal,
} from "@/features/auth/schemas";
import { requestBackend } from "@/lib/api/backend";
import {
  normalizeBackendError,
  type FrontendApiError,
} from "@/lib/api/errors";
import { getSessionToken } from "@/lib/auth/session-cookie";

type SessionLookupResult =
  | {
      ok: true;
      principal: Principal;
    }
  | {
      ok: false;
      error: FrontendApiError;
    };

export async function lookupSession(
  token: string,
): Promise<SessionLookupResult> {
  let response: Response;

  try {
    response = await requestBackend("/v1/session", {
      method: "GET",
      bearerToken: token,
    });
  } catch {
    return {
      ok: false,
      error: {
        status: 502,
        code: "server_error",
        message: "The authentication service is temporarily unavailable.",
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: await normalizeBackendError(response),
    };
  }

  const parsedResponse = authSessionResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );

  if (!parsedResponse.success) {
    return {
      ok: false,
      error: {
        status: 502,
        code: "server_error",
        message: "The authentication service returned an invalid response.",
      },
    };
  }

  return {
    ok: true,
    principal: parsedResponse.data.principal,
  };
}

export async function redirectAuthenticatedPrincipal(): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    return;
  }

  const session = await lookupSession(token);
  if (session.ok) {
    redirect("/play");
  }
}
