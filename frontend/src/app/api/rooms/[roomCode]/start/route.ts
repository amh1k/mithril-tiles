import {
  startGameRequestSchema,
  startGameResponseSchema,
  type StartGameResponse,
} from "@/features/rooms/start-game";
import { roomCodeInputSchema } from "@/features/rooms/room-code";
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
  message: "The game service is temporarily unavailable.",
};

type RouteContext = {
  params: Promise<{
    roomCode: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
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
  const { roomCode: rawRoomCode } = await context.params;
  const parsedRoomCode = roomCodeInputSchema.safeParse(rawRoomCode);
  if (!parsedRoomCode.success) {
    return frontendApiErrorResponse(
      normalizeValidationError(parsedRoomCode.error),
    );
  }

  const requestBody = await request.json().catch(() => undefined);
  const parsedRequest = startGameRequestSchema.safeParse(requestBody);
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
    backendResponse = await requestBackend(
      `/v1/rooms/${encodeURIComponent(parsedRoomCode.data)}/start`,
      {
        bearerToken: token,
        json: {
          settings_snapshot: {},
          word_pack_id: parsedRequest.data.word_pack_id,
        },
        method: "POST",
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

  const parsedResponse = startGameResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );
  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  const responseBody: StartGameResponse = parsedResponse.data;

  return Response.json(responseBody, {
    status: 201,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
