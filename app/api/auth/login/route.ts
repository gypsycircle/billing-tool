// app/api/auth/login/route.ts
// POST /api/auth/login — validates the access code and creates a session.
// Order: same-origin → JSON content type → count the attempt (rate limit) →
// body → scrypt hash check against the stored hash. A correct code takes its
// attempt back off.

import { z } from "zod";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, jsonError, methodNotAllowed } from "@/lib/server/http/respond";
import { readJsonBody } from "@/lib/server/security/body";
import { getClientIp, rateLimitClientKey } from "@/lib/server/security/client-ip";
import {
  getFailureDelay,
  recordLoginSuccess,
  registerLoginAttempt,
} from "@/lib/server/security/rate-limit";
import { verifyAccessCode } from "@/lib/server/session/access-code";
import { createSession } from "@/lib/server/session/cookies";

const loginSchema = z.object({
  code: z.string().min(1, "Access code is required.").max(256),
});

export const POST = withApiRoute({ auth: false, sameOrigin: true, json: true }, async ({ request }) => {
  // Count this attempt atomically before touching the code
  const client = rateLimitClientKey(getClientIp(request));
  const limit = await registerLoginAttempt(client);
  if (!limit.allowed) {
    return jsonError("Too many login attempts. Please try again later.", 429, {
      "Retry-After": String(limit.retryAfterSeconds ?? 900),
    });
  }

  const { data: body, error: bodyError } = await readJsonBody(request);
  if (bodyError) return bodyError;

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body.", 400);
  }

  // Throws AccessCodeNotSetError when no code is stored → generic 500 via handleApiError
  if (!(await verifyAccessCode(parsed.data.code))) {
    await new Promise((resolve) => setTimeout(resolve, getFailureDelay()));
    return jsonError("Invalid access code.", 401);
  }

  await Promise.all([recordLoginSuccess(client), createSession()]);
  return jsonOk({ ok: true });
});

export const GET = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
