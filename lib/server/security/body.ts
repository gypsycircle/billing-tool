// lib/server/security/body.ts
// Size-capped JSON body reader for the routes that take a body (withApiRoute's
// `body` option).

import "server-only";

import { jsonError } from "../http/respond";

/** 64 KB: generous for any record's JSON, blocks bulk abuse. */
const MAX_BODY_SIZE = 64 * 1024;

/**
 * Reads and parses the JSON body, refusing one over MAX_BODY_SIZE (413) or
 * one that isn't JSON (400). Returns `{ data }`, or `{ error }`: the response
 * to send instead.
 */
export async function readJsonBody(request: Request): Promise<{ data: unknown; error: null } | { data: null; error: Response }> {
  const tooLarge = () => ({ data: null, error: jsonError("Request body too large.", 413) });
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) return tooLarge();

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_SIZE) return tooLarge();
    return { data: JSON.parse(text) as unknown, error: null };
  } catch {
    return { data: null, error: jsonError("Invalid JSON body.", 400) };
  }
}
