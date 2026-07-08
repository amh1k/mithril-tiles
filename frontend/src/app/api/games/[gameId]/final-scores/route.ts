import {
  backendFinalScoresResponseSchema,
  type FinalScoresResponse,
} from "@/features/rooms/final-scores";
import { requestBackend } from "@/lib/api/backend";
import {
  frontendApiErrorResponse,
  normalizeBackendError,
  normalizeValidationError,
  type FrontendApiError,
} from "@/lib/api/errors";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { z } from "zod";

const gameIdSchema = z.uuid();

const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The final score service is temporarily unavailable.",
};

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { gameId: rawGameId } = await context.params;
  const parsedGameId = gameIdSchema.safeParse(rawGameId);
  if (!parsedGameId.success) {
    return frontendApiErrorResponse(
      normalizeValidationError(parsedGameId.error),
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
    backendResponse = await requestBackend(
      `/v1.rooms/gameFinalScore/${encodeURIComponent(parsedGameId.data)}`,
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

  const parsedResponse = backendFinalScoresResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );
  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  const responseBody: FinalScoresResponse = parsedResponse.data;

  return Response.json(responseBody, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
