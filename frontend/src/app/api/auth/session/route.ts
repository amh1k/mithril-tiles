import { lookupSession } from "@/features/auth/server/session";
import { frontendApiErrorResponse } from "@/lib/api/errors";
import { clearSessionCookie, getSessionToken } from "@/lib/auth/session-cookie";

export async function GET(): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return frontendApiErrorResponse({
      status: 401,
      code: "unauthorized",
      message: "Authentication is required.",
    });
  }

  const result = await lookupSession(token);

  if (!result.ok) {
    if (result.error.status === 401) {
      try {
        await clearSessionCookie();
      } catch {
        return frontendApiErrorResponse({
          status: 500,
          code: "server_error",
          message: "The invalid session could not be cleared.",
        });
      }
    }

    return frontendApiErrorResponse(result.error);
  }

  return Response.json(
    {
      principal: result.principal,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
