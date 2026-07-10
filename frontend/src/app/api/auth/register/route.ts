import {
  registerRequestSchema,
  userAuthResponseSchema,
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
  const parsedRequest = registerRequestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    return frontendApiErrorResponse(
      normalizeValidationError(parsedRequest.error),
    );
  }
  let backendResponse: Response;
  try {
    backendResponse = await requestBackend("/v1/users/register", {
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

  const parsedResponse = userAuthResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );

  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  const { authentication_token: token, user } = parsedResponse.data;

  try {
    await setSessionCookie(token.token, token.expiry);
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  return Response.json(
    {
      principal: {
        type: "user",
        id: user.id,
        display_name: user.display_name,
        role: user.role,
        handle: user.handle,
        avatar_url: user.avatar_url,
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
