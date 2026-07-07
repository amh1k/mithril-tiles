import {
  websocketTicketResponseSchema,
  type WebSocketTicketResponse,
} from "@/features/rooms/tickets";
import { roomCodeInputSchema } from "@/features/rooms/room-code";
import { requestBackend } from "@/lib/api/backend";
import {
  frontendApiErrorResponse,
  normalizeBackendError,
  normalizeValidationError,
  type FrontendApiError,
} from "@/lib/api/errors";
import { hasTrustedMutationOrigin } from "@/lib/api/mutation-request";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { serverEnv } from "@/lib/env/server";

const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The realtime ticket service is temporarily unavailable.",
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

  const { roomCode: rawRoomCode } = await context.params;
  const parsedRoomCode = roomCodeInputSchema.safeParse(rawRoomCode);
  if (!parsedRoomCode.success) {
    return frontendApiErrorResponse(
      normalizeValidationError(parsedRoomCode.error),
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
      `/v1/rooms/${encodeURIComponent(parsedRoomCode.data)}/ws-ticket`,
      {
        bearerToken: token,
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

  const parsedResponse = websocketTicketResponseSchema.safeParse(
    await backendResponse.json().catch(() => undefined),
  );

  if (!parsedResponse.success) {
    return frontendApiErrorResponse(backendUnavailableError);
  }

  const responseBody: WebSocketTicketResponse = {
    websocket_ticket: parsedResponse.data.websocket_ticket,
  };

  return Response.json(responseBody, {
    status: 201,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
