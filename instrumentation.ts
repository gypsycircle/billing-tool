// instrumentation.ts
// Runs once when a server instance starts. Validates configuration so a
// missing or malformed variable stops the server at boot instead of failing
// on the first request. Errors name variables only, never values.
// Then warms up the database connection (and creates collections/indexes on
// a fresh database) in the background, so the first request doesn't pay for it.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getEnv } = await import("./lib/server/env");
  getEnv();

  const { ensureDatabase } = await import("./lib/server/db/collections");
  ensureDatabase().catch((err: unknown) => {
    console.warn("[DB] Warm-up failed; will retry on the first request", {
      type: err instanceof Error ? err.name : typeof err,
    });
  });
}
