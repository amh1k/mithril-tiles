import "server-only";

import { cookies } from "next/headers";

const isProduction = process.env.NODE_ENV === "production";
export const SESSION_COOKIE_NAME = isProduction
  ? "__Host-mithril_session"
  : "mithril_session";
const sessionCookieOptions = {
  httpOnly: true,
  path: "/",
  priority: "high" as const,
  sameSite: "lax" as const,
  secure: isProduction,
};
export async function setSessionCookie(
  token: string,
  expiry: string,
): Promise<void> {
  const expires = new Date(expiry);

  if (Number.isNaN(expires.getTime())) {
    throw new Error("Cannot set a session cookie with an invalid expiry");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions,
    expires,
  });
}
export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions,
    expires: new Date(0),
    maxAge: 0,
  });
}
