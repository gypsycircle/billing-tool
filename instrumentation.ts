// instrumentation.ts
// Runs once when a server instance starts. Validates configuration so a
// missing or malformed variable stops the server at boot instead of failing
// on the first request. Errors name variables only, never values.
// Then, except on Vercel, warms up the database connection (and creates
// collections/indexes on a fresh database) in the background, so the first
// request doesn't pay for it.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getEnv } = await import("./lib/server/env");
  getEnv();

  // Not on Vercel: it pauses a function as soon as it has answered, and a
  // background connection frozen halfway fails when the instance wakes up.
  // There, the first request that needs the database connects (in Mumbai,
  // next to the cluster, that takes a few milliseconds).
  if (process.env.VERCEL) return;

  const { ensureDatabase } = await import("./lib/server/db/collections");
  const { sanitizeLogMessage } = await import("./lib/server/http/respond");
  ensureDatabase().catch((err: unknown) => {
    console.warn("[DB] Warm-up failed; will retry on the first request", {
      type: err instanceof Error ? err.name : typeof err,
      message: sanitizeLogMessage(err instanceof Error ? err.message : String(err)),
    });
  });
}
