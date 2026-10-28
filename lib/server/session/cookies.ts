// lib/server/session/cookies.ts
// Reads, creates and clears the signed session cookie.

import "server-only";

import { cookies } from "next/headers";
import {
  signSessionToken,
  verifySessionToken,
  getSessionCookieName,
  getSessionCookieOptions,
  SESSION_MAX_AGE_SECONDS,
} from "./token";

/** Signs a new session token and sets it as an HttpOnly cookie. */
export async function createSession(): Promise<void> {
  const token = await signSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), token, getSessionCookieOptions(SESSION_MAX_AGE_SECONDS));
}

/** True when the request carries a valid, unexpired session cookie. */
export async function hasValidSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;
    if (!token) return false;
    return (await verifySessionToken(token)) !== null;
  } catch {
    return false;
  }
}

/**
 * Clears the session cookie (both __Host- and plain variants, in case the
 * user switched environments). Idempotent.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const clearOptions = getSessionCookieOptions(0);

  cookieStore.set(getSessionCookieName(), "", clearOptions);
  cookieStore.set("gc_session", "", clearOptions);
  cookieStore.set("__Host-gc_session", "", clearOptions);
}
