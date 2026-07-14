import {
  botProfileMutationSchema,
  botProfilesResponseSchema,
} from "@/features/rooms/bot-profiles";
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

const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The bot profile service is temporarily unavailable.",
};

export async function GET(): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return authenticationRequiredResponse();
  }

  let backendResponse: Response;
  try {
    backendResponse = await requestBackend("/v1/admin/bot-profiles", {
      method: "GET",
      bearerToken: token,
    });
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  if (!backendResponse.ok) {
    return frontendApiErrorResponse(await normalizeBackendError(backendResponse));
  }

  const parsedResponse = botProfilesResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );
  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  return Response.json(parsedResponse.data, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedMutationOrigin(request, serverEnv.APP_ORIGIN)) {
    return forbiddenOriginResponse();
  }
  if (!hasJsonContentType(request)) {
    return jsonContentTypeResponse();
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
    backendResponse = await requestBackend("/v1/admin/bot-profiles", {
      method: "POST",
      bearerToken: token,
      json: parsedRequest.data,
    });
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  if (!backendResponse.ok) {
    return frontendApiErrorResponse(await normalizeBackendError(backendResponse));
  }

  const responseBody = await backendResponse.json().catch(() => undefined);
  return responseBody === undefined
    ? frontendApiErrorResponse(backendUnavailableError)
    : Response.json(responseBody, {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      });
}

function authenticationRequiredResponse(): Response {
  return frontendApiErrorResponse({
    status: 401,
    code: "unauthorized",
    message: "Authentication is required.",
  });
}

function forbiddenOriginResponse(): Response {
  return frontendApiErrorResponse({
    status: 403,
    code: "forbidden",
    message: "The request origin is not allowed.",
  });
}

function jsonContentTypeResponse(): Response {
  return frontendApiErrorResponse({
    status: 415,
    code: "bad_request",
    message: "Content-Type must be application/json.",
  });
}
