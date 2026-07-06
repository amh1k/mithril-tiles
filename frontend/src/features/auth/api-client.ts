import {
  guestSessionResponseSchema,
  type GuestPrincipal,
  type GuestRequest,
  type LoginRequest,
  type RegisterRequest,
  type UserPrincipal,
  userSessionResponseSchema,
} from "@/features/auth/schemas";
import {
  frontendApiErrorSchema,
  type FrontendApiError,
} from "@/lib/api/errors";
import type { ZodType } from "zod";

export class AuthRequestError extends Error {
  readonly detail: FrontendApiError;

  constructor(detail: FrontendApiError) {
    super(detail.message);
    this.name = "AuthRequestError";
    this.detail = detail;
  }
}
export async function createGuestSession(
  request: GuestRequest,
): Promise<GuestPrincipal> {
  const response = await postAuthentication(
    "/api/auth/guest",
    request,
    guestSessionResponseSchema,
  );

  return response.principal;
}

export async function login(request: LoginRequest): Promise<UserPrincipal> {
  const response = await postAuthentication(
    "/api/auth/login",
    request,
    userSessionResponseSchema,
  );

  return response.principal;
}

export async function registerUser(
  request: RegisterRequest,
): Promise<UserPrincipal> {
  const response = await postAuthentication(
    "/api/auth/register",
    request,
    userSessionResponseSchema,
  );

  return response.principal;
}

type AuthenticationPath =
  | "/api/auth/guest"
  | "/api/auth/login"
  | "/api/auth/register";

async function postAuthentication<TResponse>(
  path: AuthenticationPath,
  request: unknown,
  responseSchema: ZodType<TResponse>,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    cache: "no-store",
    credentials: "same-origin",
  });

  const responseBody = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsedError = frontendApiErrorSchema.safeParse(responseBody);

    throw new AuthRequestError(
      parsedError.success
        ? parsedError.data
        : {
            status: response.status,
            code: response.status >= 500 ? "server_error" : "bad_request",
            message: "The authentication request could not be completed.",
          },
    );
  }

  const parsedResponse = responseSchema.safeParse(responseBody);

  if (!parsedResponse.success) {
    throw new AuthRequestError({
      status: 502,
      code: "server_error",
      message: "The authentication service returned an invalid response.",
    });
  }

  return parsedResponse.data;
}
