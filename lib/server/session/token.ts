// lib/server/session/token.ts
// Pure jose session-token helpers — no next/headers dependency.
// Importable by proxy.ts (which cannot use next/headers) as well as
// session/cookies.ts.
//
// IMPORTANT: server code only. It deliberately has no `server-only` import
// and reads SESSION_SECRET directly (not via env.ts) so proxy.ts can use it.
// Never import it from a client component.

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Algorithm pinned for signing/verifying — rejects `alg: none` and others. */
const ALG = "HS256" as const;

/** Issuer claim — pinned in verification. */
const ISSUER = "gypsycircle-billing";

/** Audience claim — pinned in verification. */
const AUDIENCE = "gypsycircle-billing-app";

/** Subject claim — shared-access model (V1). */
const SUBJECT = "shared-access";

/** Session lifetime in seconds — 12 hours. Single constant for token + cookie. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

/**
 * Cookie name adapts to the environment:
 * - Production uses `__Host-` prefix (forces Secure, Path=/, no Domain).
 * - Development uses a plain name (no HTTPS on localhost).
 */
export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-gc_session"
    : "gc_session";
}

/** Cookie options shared by set and clear operations. */
export function getSessionCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

// ---------------------------------------------------------------------------
// Secret key
// ---------------------------------------------------------------------------

/** Returns the session secret as a Uint8Array for jose. */
function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (minimum 32 characters)."
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Sign / Verify
// ---------------------------------------------------------------------------

/**
 * Creates a signed JWT session token with pinned claims.
 * Includes a random `jti` for future revocation/audit.
 */
export async function signSessionToken(): Promise<string> {
  const key = getSecretKey();
  const jti = crypto.randomUUID();

  return new SignJWT({ sub: SUBJECT })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .sign(key);
}

/**
 * Verifies a session token string.
 * Returns the payload on success, or `null` on any failure.
 * Pins algorithm, issuer and audience — rejects alg:none, wrong issuer, etc.
 */
export async function verifySessionToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALG],
      issuer: ISSUER,
      audience: AUDIENCE,
      // Also bounds the token's age by its `iat`: a missing or future `iat`,
      // or a token older than the session lifetime, is rejected.
      maxTokenAge: SESSION_MAX_AGE_SECONDS,
      requiredClaims: ["iat", "exp", "jti"],
    });
    return payload;
  } catch {
    return null;
  }
}
