import { participantPrincipalResponseSchema } from "@/features/rooms/final-scores";
import { requestBackend } from "@/lib/api/backend";
import {
  frontendApiErrorResponse,
  normalizeBackendError,
  normalizeValidationError,
  type FrontendApiError,
} from "@/lib/api/errors";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { z } from "zod";

const routeParamsSchema = z.object({
  gameId: z.uuid(),
  participantId: z.uuid(),
});

const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The participant service is temporarily unavailable.",
};

type RouteContext = {
  params: Promise<{
    gameId: string;
    participantId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const parsedParams = routeParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return frontendApiErrorResponse(
      normalizeValidationError(parsedParams.error),
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

  const { gameId, participantId } = parsedParams.data;
  let backendResponse: Response;

  try {
    backendResponse = await requestBackend(
      `/v1/games/${encodeURIComponent(gameId)}/participants/${encodeURIComponent(participantId)}/principal`,
      {
        bearerToken: token,
        method: "GET",
      },
    );
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  if (!backendResponse.ok) {
    return frontendApiErrorResponse(
      await normalizeBackendError(backendResponse),
    );
  }

  const parsedResponse = participantPrincipalResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );
  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  return Response.json(parsedResponse.data, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
