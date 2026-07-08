import {
  backendWordPacksResponseSchema,
  type WordPacksResponse,
} from "@/features/rooms/word-pack";
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
  message: "The word pack service is temporarily unavailable.",
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
    backendResponse = await requestBackend("/v1/word-packs-getall", {
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

  const parsedResponse = backendWordPacksResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );
  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  const responseBody: WordPacksResponse = parsedResponse.data;

  return Response.json(responseBody, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
