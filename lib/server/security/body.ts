// lib/server/security/body.ts
// Size-capped JSON body reader for POST/PATCH routes.

import "server-only";

// ---------------------------------------------------------------------------
// Maximum request body size (bytes) — prevents abuse on POST/PATCH
// ---------------------------------------------------------------------------

/** 64 KB — generous for JSON booking payloads, blocks bulk abuse. */
const MAX_BODY_SIZE = 64 * 1024;

// ---------------------------------------------------------------------------
// Body size guard
// ---------------------------------------------------------------------------

/**
 * Reads and parses the JSON body, rejecting if it exceeds MAX_BODY_SIZE.
 * Returns `{ data, error }` — if `error` is non-null, return it as the response.
 */
export async function readJsonBody<T = unknown>(
  request: Request
): Promise<{ data: T | null; error: Response | null }> {
  // Check Content-Length if available
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return {
      data: null,
      error: Response.json(
        { error: "Request body too large." },
        { status: 413, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_SIZE) {
      return {
        data: null,
        error: Response.json(
          { error: "Request body too large." },
          { status: 413, headers: { "Cache-Control": "no-store" } }
        ),
      };
    }

    const data = JSON.parse(text) as T;
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: Response.json(
        { error: "Invalid JSON body." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
}
