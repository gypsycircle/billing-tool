// lib/domain/safe-redirect.ts
// Validates the `next` parameter used to return to a page after login.
// Used on the server (access page) and again in the browser before navigating.

const FALLBACK = "/bookings";
const MAX_LENGTH = 512;
const BASE = "http://local.invalid";

/** Protocol-relative start, any backslash (browsers treat "/\host" as "//host"), or control characters. */
function looksUnsafe(path: string): boolean {
  return path.startsWith("//") || path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path);
}

/**
 * Returns `next` if it is a same-origin path, otherwise "/bookings".
 * Rejects protocol-relative URLs, backslashes, control characters — also
 * when only percent-decoding reveals them (e.g. "/%5Cevil.com") — other
 * origins, and the access page itself (/ and the old /access).
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0 || next.length > MAX_LENGTH) return FALLBACK;
  if (!next.startsWith("/") || looksUnsafe(next)) return FALLBACK;

  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return FALLBACK; // malformed percent-encoding
  }
  if (looksUnsafe(decoded)) return FALLBACK;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== BASE) return FALLBACK;
  if (url.pathname === "/" || url.pathname === "/access" || url.pathname.startsWith("/access/")) return FALLBACK;

  // URL parsing collapses dot segments ("/.//evil.com" → "//evil.com"), so the
  // result must pass the same checks as the input.
  const result = `${url.pathname}${url.search}${url.hash}`;
  return looksUnsafe(result) ? FALLBACK : result;
}
