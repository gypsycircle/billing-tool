// lib/server/security/origin.ts
// Same-origin and content-type guards for mutating API routes (CSRF defence
// alongside the SameSite=Lax session cookie and JSON-only bodies).

import "server-only";

import { getEnv } from "../env";

function forbidden(error: string): Response {
  return Response.json({ error }, { status: 403, headers: { "Cache-Control": "no-store" } });
}

/**
 * The origin requests must come from: APP_URL, or in development the
 * request's own origin. Forwarding headers such as x-forwarded-host are
 * never trusted.
 */
function expectedOrigin(request: Request): string {
  const { APP_URL } = getEnv();
  return new URL(APP_URL ?? request.url).origin;
}

/**
 * Rejects a mutating request (POST/PATCH/DELETE) that is not same-origin.
 * Returns null when allowed, or a 403 Response.
 *
 * 1. `Origin` must be present and equal the expected origin.
 * 2. If the browser sends `Sec-Fetch-Site`, it must be `same-origin`.
 */
export function assertSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return forbidden("Forbidden: missing Origin header.");

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return forbidden("Forbidden: invalid Origin header.");
  }
  if (originUrl.origin !== expectedOrigin(request)) {
    return forbidden("Forbidden: cross-origin request.");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    return forbidden("Forbidden: cross-origin request.");
  }

  return null;
}

/**
 * Ensures the request has `Content-Type: application/json`.
 * Returns null on success, or a 415 Response.
 */
export function assertJsonContentType(request: Request): Response | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return Response.json(
      { error: "Unsupported Media Type. Send application/json." },
      { status: 415, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}
