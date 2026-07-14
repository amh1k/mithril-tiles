import { z } from "zod";

import { botProfileMutationSchema } from "@/features/rooms/bot-profiles";
import { requestBackend } from "@/lib/api/backend";
import {
  frontendApiErrorResponse,
  normalizeBackendError,
  normalizeValidationError,
  type FrontendApiError,
} from "@/lib/api/errors";
import {
  hasJsonContentType,
  hasTrustedMutationOrigin,
} from "@/lib/api/mutation-request";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { serverEnv } from "@/lib/env/server";

const botProfileIDSchema = z.uuid();
const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The bot profile service is temporarily unavailable.",
};

type RouteContext = { params: Promise<{ botProfileId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!hasTrustedMutationOrigin(request, serverEnv.APP_ORIGIN)) {
    return forbiddenOriginResponse();
  }
  if (!hasJsonContentType(request)) {
    return jsonContentTypeResponse();
  }

  const botProfileID = await parseBotProfileID(context);
  if (!botProfileID) {
    return notFoundResponse();
  }
  const parsedRequest = botProfileMutationSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!parsedRequest.success) {
    return frontendApiErrorResponse(normalizeValidationError(parsedRequest.error));
  }

  const token = await getSessionToken();
  if (!token) {
    return authenticationRequiredResponse();
  }

  let backendResponse: Response;
  try {
    backendResponse = await requestBackend(
      `/v1/admin/bot-profiles/${encodeURIComponent(botProfileID)}`,
      { method: "PATCH", bearerToken: token, json: parsedRequest.data },
    );
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  if (!backendResponse.ok) {
    return frontendApiErrorResponse(await normalizeBackendError(backendResponse));
  }

  const responseBody = await backendResponse.json().catch(() => undefined);
  return responseBody === undefined
    ? frontendApiErrorResponse(backendUnavailableError)
    : Response.json(responseBody, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  if (!hasTrustedMutationOrigin(request, serverEnv.APP_ORIGIN)) {
    return forbiddenOriginResponse();
  }

  const botProfileID = await parseBotProfileID(context);
  if (!botProfileID) {
    return notFoundResponse();
  }
  const token = await getSessionToken();
  if (!token) {
    return authenticationRequiredResponse();
  }

  let backendResponse: Response;
  try {
    backendResponse = await requestBackend(
      `/v1/admin/bot-profiles/${encodeURIComponent(botProfileID)}`,
      { method: "DELETE", bearerToken: token },
    );
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  if (!backendResponse.ok) {
    return frontendApiErrorResponse(await normalizeBackendError(backendResponse));
  }

  return new Response(null, { headers: { "Cache-Control": "no-store" } });
}

async function parseBotProfileID(context: RouteContext): Promise<string | null> {
  const { botProfileId } = await context.params;
  const parsedID = botProfileIDSchema.safeParse(botProfileId);
  return parsedID.success ? parsedID.data : null;
}

function authenticationRequiredResponse(): Response {
  return frontendApiErrorResponse({ status: 401, code: "unauthorized", message: "Authentication is required." });
}

function forbiddenOriginResponse(): Response {
  return frontendApiErrorResponse({ status: 403, code: "forbidden", message: "The request origin is not allowed." });
}

function jsonContentTypeResponse(): Response {
  return frontendApiErrorResponse({ status: 415, code: "bad_request", message: "Content-Type must be application/json." });
}

function notFoundResponse(): Response {
  return frontendApiErrorResponse({ status: 404, code: "not_found", message: "The requested bot profile was not found." });
}
