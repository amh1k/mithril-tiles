import { z } from "zod";

import { wordPackMutationSchema } from "@/features/admin/word-pack-management";
import { wordPackResponseSchema } from "@/features/rooms/word-pack";
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

const wordPackIDSchema = z.uuid();
const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The word pack service is temporarily unavailable.",
};

type RouteContext = { params: Promise<{ wordPackId: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!hasTrustedMutationOrigin(request, serverEnv.APP_ORIGIN)) {
    return forbiddenOriginResponse();
  }
  if (!hasJsonContentType(request)) {
    return frontendApiErrorResponse({
      status: 415,
      code: "bad_request",
      message: "Content-Type must be application/json.",
    });
  }

  const wordPackID = await parseWordPackID(context);
  if (!wordPackID) {
    return notFoundResponse();
  }

  const parsedRequest = wordPackMutationSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!parsedRequest.success) {
    return frontendApiErrorResponse(
      normalizeValidationError(parsedRequest.error),
    );
  }

  const token = await getSessionToken();
  if (!token) {
    return authenticationRequiredResponse();
  }

  let backendResponse: Response;
  try {
    backendResponse = await requestBackend(`/v1/word-packs/${wordPackID}`, {
      method: "PATCH",
      bearerToken: token,
      json: parsedRequest.data,
    });
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  if (!backendResponse.ok) {
    return frontendApiErrorResponse(
      await normalizeBackendError(backendResponse),
    );
  }

  const parsedResponse = wordPackResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );
  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  return Response.json(parsedResponse.data, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!hasTrustedMutationOrigin(request, serverEnv.APP_ORIGIN)) {
    return forbiddenOriginResponse();
  }

  const wordPackID = await parseWordPackID(context);
  if (!wordPackID) {
    return notFoundResponse();
  }

  const token = await getSessionToken();
  if (!token) {
    return authenticationRequiredResponse();
  }

  let backendResponse: Response;
  try {
    backendResponse = await requestBackend(`/v1/word-packs/${wordPackID}`, {
      method: "DELETE",
      bearerToken: token,
    });
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  if (!backendResponse.ok) {
    return frontendApiErrorResponse(
      await normalizeBackendError(backendResponse),
    );
  }

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

async function parseWordPackID(context: RouteContext): Promise<string | null> {
  const { wordPackId } = await context.params;
  const parsedID = wordPackIDSchema.safeParse(wordPackId);
  return parsedID.success ? parsedID.data : null;
}

function forbiddenOriginResponse(): Response {
  return frontendApiErrorResponse({
    status: 403,
    code: "forbidden",
    message: "The request origin is not allowed.",
  });
}

function authenticationRequiredResponse(): Response {
  return frontendApiErrorResponse({
    status: 401,
    code: "unauthorized",
    message: "Authentication is required.",
  });
}

function notFoundResponse(): Response {
  return frontendApiErrorResponse({
    status: 404,
    code: "not_found",
    message: "The requested word pack could not be found.",
  });
}
