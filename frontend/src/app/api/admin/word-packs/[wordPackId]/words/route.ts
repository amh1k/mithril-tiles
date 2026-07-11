import { z } from "zod";

import {
  wordMutationSchema,
  wordResponseSchema,
} from "@/features/admin/word-pack-management";
import { lookupSession } from "@/features/auth/server/session";
import { requestBackend } from "@/lib/api/backend";
import {
  frontendApiErrorResponse,
  normalizeBackendError,
  normalizeValidationError,
} from "@/lib/api/errors";
import {
  hasJsonContentType,
  hasTrustedMutationOrigin,
} from "@/lib/api/mutation-request";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { serverEnv } from "@/lib/env/server";

const wordPackIDSchema = z.uuid();

type RouteContext = { params: Promise<{ wordPackId: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!hasTrustedMutationOrigin(request, serverEnv.APP_ORIGIN)) {
    return errorResponse(403, "forbidden", "The request origin is not allowed.");
  }
  if (!hasJsonContentType(request)) {
    return errorResponse(415, "bad_request", "Content-Type must be application/json.");
  }

  const wordPackID = await parseWordPackID(context);
  if (!wordPackID) {
    return errorResponse(404, "not_found", "The requested word pack was not found.");
  }

  const parsedRequest = wordMutationSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!parsedRequest.success) {
    return frontendApiErrorResponse(normalizeValidationError(parsedRequest.error));
  }

  const token = await getSessionToken();
  if (!token) {
    return errorResponse(401, "unauthorized", "Authentication is required.");
  }

  const session = await lookupSession(token);
  if (!session.ok) {
    return frontendApiErrorResponse(session.error);
  }
  if (session.principal.type !== "user" || session.principal.role !== "admin") {
    return errorResponse(403, "forbidden", "Administrator access is required.");
  }

  let backendResponse: Response;
  try {
    backendResponse = await requestBackend(`/v1/word-packs/${wordPackID}/words`, {
      method: "POST",
      bearerToken: token,
      json: parsedRequest.data,
    });
  } catch {
    return errorResponse(
      502,
      "server_error",
      "The word service is temporarily unavailable.",
    );
  }

  if (!backendResponse.ok) {
    return frontendApiErrorResponse(await normalizeBackendError(backendResponse));
  }

  const parsedResponse = wordResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );
  if (!parsedResponse.success) {
    return errorResponse(
      502,
      "server_error",
      "The word service returned an invalid response.",
    );
  }

  return Response.json(parsedResponse.data, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}

async function parseWordPackID(context: RouteContext): Promise<string | null> {
  const { wordPackId } = await context.params;
  const parsedID = wordPackIDSchema.safeParse(wordPackId);
  return parsedID.success ? parsedID.data : null;
}

function errorResponse(
  status: 401 | 403 | 404 | 415 | 502,
  code: "bad_request" | "forbidden" | "not_found" | "server_error" | "unauthorized",
  message: string,
): Response {
  return frontendApiErrorResponse({ status, code, message });
}
