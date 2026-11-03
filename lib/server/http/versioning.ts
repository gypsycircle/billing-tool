// lib/server/http/versioning.ts
// Reading the record version and idempotency key a write request carries.
// Shared by every record's routes (bookings, expenses, team members, list items).

import "server-only";

import { IDEMPOTENCY_HEADER, RECORD_VERSION_HEADER } from "@/lib/domain/records";

/** Client-chosen key that makes a create safe to retry (letters, digits and -, 16–64 long). */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{16,64}$/;

/** The version (updatedAt) the client is changing ("" if absent or malformed). */
export function expectedVersion(request: Request): string {
  const value = request.headers.get(RECORD_VERSION_HEADER)?.trim() ?? "";
  return value.length <= 64 ? value : "";
}

/** The create's idempotency key, if it carried a valid one. */
export function idempotencyKeyOf(request: Request): string | undefined {
  const key = request.headers.get(IDEMPOTENCY_HEADER) ?? "";
  return IDEMPOTENCY_KEY.test(key) ? key : undefined;
}
