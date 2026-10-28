// proxy.ts
// Runs before every request (except framework assets):
//   1. HTTPS redirect in production (loopback hosts exempt, for local testing)
//   2. Per-request nonce Content-Security-Policy
//   3. Layer 1 optimistic session check (signature + expiry only, no I/O).
//      Every page gate, route handler and service re-verifies (Layer 2).
//
// Public surface (no session required):
//   / (the access page), POST /api/auth/login, POST /api/auth/logout,
//   the PWA's manifest and service worker (no data in either), and
//   framework assets. (/access is redirected to / by next.config.ts.)
// Uses session/token.ts, which has no next/headers or server-only import.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getSessionCookieName,
  getSessionCookieOptions,
  verifySessionToken,
} from "@/lib/server/session/token";

const isProduction = process.env.NODE_ENV === "production";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Reachable without a session: login/logout (logout must work with a bad cookie) and the PWA files. */
const PUBLIC_PATHS = new Set(["/api/auth/login", "/api/auth/logout", "/manifest.webmanifest", "/sw.js"]);

// ---------------------------------------------------------------------------
// Content-Security-Policy
// ---------------------------------------------------------------------------

/**
 * Scripts: only this response's nonce ('strict-dynamic' lets those scripts
 * load the rest of the app). Styles allow inline because Base UI positions
 * popovers with style attributes and Sonner injects a <style> tag — neither
 * can carry a nonce. 'unsafe-eval' is development-only (React debugging).
 */
function buildCsp(nonce: string, upgradeInsecure: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    // The service worker (/sw.js). Without this it would fall back to
    // script-src, where 'strict-dynamic' ignores 'self' and blocks it.
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(upgradeInsecure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

type SessionState = "valid" | "invalid" | "none";

async function sessionState(request: NextRequest): Promise<SessionState> {
  const token = request.cookies.get(getSessionCookieName())?.value;
  if (!token) return "none";
  return (await verifySessionToken(token)) ? "valid" : "invalid";
}

/** Expires a bad session cookie on the given response. */
function clearSessionCookie(response: NextResponse | Response): void {
  if (response instanceof NextResponse) {
    response.cookies.set(getSessionCookieName(), "", getSessionCookieOptions(0));
  }
}

/** Redirect to the access page at /, keeping the requested path in `next`. */
function accessRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const originalPath = url.pathname + url.search;
  url.pathname = "/";
  url.search = originalPath !== "/" && originalPath !== "/bookings" ? `?next=${encodeURIComponent(originalPath)}` : "";
  return NextResponse.redirect(url);
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, hostname } = request.nextUrl;
  const isLoopback = LOOPBACK_HOSTS.has(hostname);

  // ── 1. HTTPS redirect ─────────────────────────────────────────────────
  if (isProduction && !isLoopback && request.headers.get("x-forwarded-proto") === "http") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // ── 2. Nonce CSP ──────────────────────────────────────────────────────
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isProduction && !isLoopback);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp); // Next.js reads the nonce from here

  const finish = (response: NextResponse): NextResponse => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };
  const pass = () => finish(NextResponse.next({ request: { headers: requestHeaders } }));

  // ── 3. Session check ──────────────────────────────────────────────────
  const session = await sessionState(request);

  // The access page at "/" (exactly): signed-in users go to the bookings ledger
  if (pathname === "/") {
    if (session === "valid") {
      const url = request.nextUrl.clone();
      url.pathname = "/bookings";
      url.search = "";
      return finish(NextResponse.redirect(url));
    }
    const response = pass();
    if (session === "invalid") clearSessionCookie(response);
    return response;
  }

  if (PUBLIC_PATHS.has(pathname)) return pass();

  if (session === "valid") return pass();

  // Not signed in: APIs → 401 JSON, pages → the access page at /
  const response = pathname.startsWith("/api/")
    ? NextResponse.json(
        { error: "Unauthorized. Please log in with a valid access code." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    : accessRedirect(request);
  if (session === "invalid") clearSessionCookie(response);
  return finish(response);
}

// ---------------------------------------------------------------------------
// Matcher — only framework assets and the favicon are excluded.
// No extension-based exclusions: /api/bookings.png must still be checked.
// ---------------------------------------------------------------------------

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
