ketimport { frontendApiErrorResponse } from "@/lib/api/errors";
import { hasTrustedMutationOrigin } from "@/lib/api/mutation-request";
import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { serverEnv } from "@/lib/env/server";

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedMutationOrigin(request, serverEnv.APP_ORIGIN)) {
    return frontendApiErrorResponse({
      status: 403,
      code: "forbidden",
      message: "The request origin is not allowed.",
    });
  }
  try {
    await clearSessionCookie();
  } catch {
    return frontendApiErrorResponse({
      status: 500,
      code: "server_error",
      message: "The session could not be cleared.",
    });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
