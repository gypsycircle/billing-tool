// lib/server/guards.ts
// Authoritative session checks (Layer 2). proxy.ts is only an optimistic
// pre-filter; every page gate, route handler and service call re-verifies.

import "server-only";

import { redirect } from "next/navigation";
import { hasValidSession } from "./session/cookies";
import { UnauthorizedError } from "./errors";

/** Service-layer guard: throws UnauthorizedError when there is no valid session. */
export async function verifySession(): Promise<void> {
  if (!(await hasValidSession())) throw new UnauthorizedError();
}

/** Page guard: redirects to the access page (/) when there is no valid session. */
export async function requireSessionOrRedirect(): Promise<void> {
  if (!(await hasValidSession())) redirect("/");
}
