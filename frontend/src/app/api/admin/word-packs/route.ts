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

const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The word pack service is temporarily unavailable.",
};

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedMutationOrigin(request, serverEnv.APP_ORIGIN)) {
    return frontendApiErrorResponse({
      status: 403,
      code: "forbidden",
      message: "The request origin is not allowed.",
    });
  }
  if (!hasJsonContentType(request)) {
    return frontendApiErrorResponse({
      status: 415,
      code: "bad_request",
      message: "Content-Type must be application/json.",
    });
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
    return frontendApiErrorResponse({
      status: 401,
      code: "unauthorized",
      message: "Authentication is required.",
    });
  }

  let backendResponse: Response;
  try {
    backendResponse = await requestBackend("/v1/word-packs", {
      method: "POST",
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
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
