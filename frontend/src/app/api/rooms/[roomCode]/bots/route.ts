import { z } from "zod";

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

const botMutationSchema = z.object({ id: z.uuid() });
const backendUnavailableError: FrontendApiError = {
  status: 502,
  code: "server_error",
  message: "The bot service is temporarily unavailable.",
};

type RouteContext = { params: Promise<{ roomCode: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return mutateRoomBots(request, context, "POST");
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return mutateRoomBots(request, context, "DELETE");
}

async function mutateRoomBots(
  request: Request,
  context: RouteContext,
  method: "POST" | "DELETE",
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
    return frontendApiErrorResponse(normalizeValidationError(parsedRoomCode.error));
  }
  const parsedBody = botMutationSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!parsedBody.success) {
    return frontendApiErrorResponse(normalizeValidationError(parsedBody.error));
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
      `/v1/rooms/${encodeURIComponent(parsedRoomCode.data)}/bots`,
      { bearerToken: token, json: parsedBody.data, method },
    );
  } catch {
    return frontendApiErrorResponse(backendUnavailableError);
  }
  if (!backendResponse.ok) {
    return frontendApiErrorResponse(
      await normalizeBackendError(backendResponse),
    );
  }

  return new Response(null, { status: 204 });
}
