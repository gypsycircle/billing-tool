// lib/server/session/login.ts
// Signing in with the access code. Every attempt is counted (rate limit)
// before the code is looked at, so parallel bursts can't slip past the limit;
// a wrong code waits a moment before answering; a right one takes its attempt
// back off and starts a session.

import "server-only";

import { loginSchema } from "@/lib/domain/login.schema";
import { InvalidAccessCodeError, TooManyAttemptsError } from "../errors";
import { validate } from "../records/rules";
import { rateLimitClientKey } from "../security/client-ip";
import { getFailureDelay, recordLoginSuccess, registerLoginAttempt } from "../security/rate-limit";
import { verifyAccessCode } from "./access-code";
import { createSession } from "./cookies";

/** `clientIp` from the host's headers (getClientIp). Throws 429, 422, 401, or AccessCodeNotSetError (generic 500). */
export async function logIn(input: unknown, clientIp: string): Promise<void> {
  const client = rateLimitClientKey(clientIp);
  const limit = await registerLoginAttempt(client);
  if (!limit.allowed) throw new TooManyAttemptsError(limit.retryAfterSeconds ?? 900);

  const { code } = validate(loginSchema, input);
  if (!(await verifyAccessCode(code))) {
    await new Promise((resolve) => setTimeout(resolve, getFailureDelay()));
    throw new InvalidAccessCodeError();
  }
  await Promise.all([recordLoginSuccess(client), createSession()]);
}
