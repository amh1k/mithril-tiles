import {
  guestAuthResponseSchema,
  guestRequestSchema,
} from "@/features/auth/schemas";
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
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { serverEnv } from "@/lib/env/server";

const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The authentication service is temporarily unavailable.",
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
  const requestBody = await request.json().catch(() => undefined);
  const parsedRequest = guestRequestSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return frontendApiErrorResponse(
      normalizeValidationError(parsedRequest.error),
    );
  }

  let backendResponse: Response;
  try {
    backendResponse = await requestBackend("/v1/guest-sessions", {
      method: "POST",
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
  const parsedResponse = guestAuthResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );
  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  const { authentication_token: token, guest_session: guest } =
    parsedResponse.data;
  try {
    await setSessionCookie(token.token, token.expiry);
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  return Response.json(
    {
      principal: {
        type: "guest",
        id: guest.id,
        display_name: guest.display_name,
      },
    },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
