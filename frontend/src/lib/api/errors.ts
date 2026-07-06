import { z } from "zod";

const backendErrorSchema = z.object({
  error: z.union([z.string(), z.record(z.string(), z.string())]),
});

export type FrontendApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "rate_limited"
  | "server_error";

export type FrontendApiError = {
  status: number;
  code: FrontendApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
};

export function normalizeValidationError(
  error: z.ZodError,
): FrontendApiError {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }

  return {
    status: 422,
    code: "validation_failed",
    message: "One or more fields are invalid.",
    fieldErrors,
  };
}

export function frontendApiErrorResponse(
  error: FrontendApiError,
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
  });

  if (error.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(error.retryAfterSeconds));
  }

  return Response.json(error, {
    status: error.status,
    headers,
  });
}

const fallbackMessages: Record<FrontendApiErrorCode, string> = {
  bad_request: "The request could not be processed.",
  unauthorized: "Authentication is required.",
  forbidden: "You do not have permission to perform this action.",
  not_found: "The requested resource could not be found.",
  conflict: "The request conflicts with the current state.",
  validation_failed: "One or more fields are invalid.",
  rate_limited: "Too many requests. Please try again later.",
  server_error: "The server encountered an unexpected error.",
};

function codeForStatus(status: number): FrontendApiErrorCode {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation_failed";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server_error" : "bad_request";
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
}

export async function normalizeBackendError(
  response: Response,
): Promise<FrontendApiError> {
  const code = codeForStatus(response.status);
  const parsedBody = backendErrorSchema.safeParse(
    await response.json().catch(() => undefined),
  );

  const backendError = parsedBody.success
    ? parsedBody.data.error
    : fallbackMessages[code];

  const error: FrontendApiError = {
    status: response.status,
    code,
    message:
      typeof backendError === "string"
        ? backendError
        : fallbackMessages.validation_failed,
  };

  if (typeof backendError !== "string") {
    error.fieldErrors = backendError;
  }

  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfter(
      response.headers.get("Retry-After"),
    );

    if (retryAfterSeconds !== undefined) {
      error.retryAfterSeconds = retryAfterSeconds;
    }
  }

  return error;
}
