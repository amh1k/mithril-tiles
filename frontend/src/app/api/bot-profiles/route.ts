import { requestBackend } from "@/lib/api/backend";
import {
  frontendApiErrorResponse,
  normalizeBackendError,
  type FrontendApiError,
} from "@/lib/api/errors";
import { getSessionToken } from "@/lib/auth/session-cookie";

const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The bot profile service is temporarily unavailable.",
};

export async function GET(): Promise<Response> {
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
    backendResponse = await requestBackend("/v1/bot-profiles", {
      bearerToken: token,
      method: "GET",
    });
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  if (!backendResponse.ok) {
    return frontendApiErrorResponse(
      await normalizeBackendError(backendResponse),
    );
  }

  const responseBody = await backendResponse.json().catch(() => undefined);
  if (responseBody === undefined) {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  return Response.json(responseBody, {
    headers: { "Cache-Control": "no-store" },
  });
}
