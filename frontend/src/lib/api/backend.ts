import "server-only";

import { serverEnv } from "@/lib/env/server";

const DEFAULT_TIMEOUT_MS = 10_000;
type BackendRequestOptions = Omit<
  RequestInit,
  "body" | "cache" | "credentials" | "redirect" | "signal"
> & {
  bearerToken?: string;
  json?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};
export async function requestBackend(
  path: `/${string}`,
  options: BackendRequestOptions = {},
): Promise<Response> {
  const {
    bearerToken,
    headers: initialHeaders,
    json,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...requestInit
  } = options;

  const baseUrl = new URL(serverEnv.BACKEND_API_URL);
  const url = new URL(path, baseUrl);

  if (url.origin !== baseUrl.origin) {
    throw new Error(
      "Backend request path must remain on the configured origin",
    );
  }

  const headers = new Headers(initialHeaders);
  headers.set("Accept", "application/json");

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  return fetch(url, {
    ...requestInit,
    body: json === undefined ? undefined : JSON.stringify(json),
    cache: "no-store",
    credentials: "omit",
    headers,
    redirect: "error",
    signal: requestSignal,
  });
}
