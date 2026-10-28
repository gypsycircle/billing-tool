// lib/server/security/rate-limit/index.ts
// Login rate limiter.
//   • 5 failed attempts per client (IP, or IPv6 /64) per 15 minutes
//   • 40 failed attempts across all clients per 15 minutes
//
// Every attempt is counted atomically BEFORE the code is checked, so a burst
// of parallel requests cannot all slip in under the limit. A correct code then
// takes its own attempt back off: the client's counter is cleared and the
// global one decremented — so only failures accumulate.
//
// Counters live in MongoDB (shared by all Vercel instances). If the database
// is unreachable, the in-memory store is used for that request rather than
// locking everyone out.

import "server-only";

import { memoryStore } from "./memory";
import { mongoStore } from "./mongo";
import type { CounterStore } from "./store";

const PER_CLIENT_MAX_FAILURES = 5;
const GLOBAL_MAX_FAILURES = 40;
const WINDOW_MS = 15 * 60 * 1000;
const FAILURE_DELAY_MS = 500;

const GLOBAL_KEY = "global";
const clientKey = (client: string) => `ip:${client}`;

async function withStore<T>(task: (s: CounterStore) => Promise<T>): Promise<T> {
  try {
    return await task(mongoStore);
  } catch (err) {
    console.error("[RateLimit] Store unavailable, using memory for this request", {
      type: err instanceof Error ? err.name : typeof err,
    });
    return task(memoryStore);
  }
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Counts this login attempt and says whether it may proceed.
 * Call BEFORE checking the access code; `client` comes from rateLimitClientKey().
 */
export async function registerLoginAttempt(client: string): Promise<RateLimitResult> {
  const [perClient, global] = await withStore((s) => s.increment([clientKey(client), GLOBAL_KEY], WINDOW_MS));

  const blocked =
    perClient.count > PER_CLIENT_MAX_FAILURES ? perClient
    : global.count > GLOBAL_MAX_FAILURES ? global
    : null;

  return blocked
    ? { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(blocked.resetInMs / 1000)) }
    : { allowed: true };
}

/** After a correct code: clear the client's counter and take this attempt off the global one. */
export async function recordLoginSuccess(client: string): Promise<void> {
  await withStore((s) => Promise.all([s.reset(clientKey(client)), s.decrement(GLOBAL_KEY)]));
}

/** Uniform delay (ms) to await after a failed attempt. */
export function getFailureDelay(): number {
  return FAILURE_DELAY_MS;
}
