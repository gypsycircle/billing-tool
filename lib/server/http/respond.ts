// lib/server/http/respond.ts
// Uniform API response helpers and error handler.
// All API routes use these to produce consistent { error } responses
// with correct status codes and no leaked internals.

import "server-only";

import {
  MongoError,
  MongoNetworkError,
  MongoNetworkTimeoutError,
  MongoOperationTimeoutError,
  MongoParseError,
  MongoServerError,
  MongoServerSelectionError,
} from "mongodb";
import { EnvConfigError } from "../env";
import {
  AccessCodeNotSetError,
  BookingNotFoundError,
  BookingValidationError,
  BookingArchivedError,
  BillUnavailableError,
  DuplicateInvoiceNumberError,
  MissingVersionError,
  StaleBookingError,
  UnauthorizedError,
} from "../errors";

// ---------------------------------------------------------------------------
// Standard response helpers
// ---------------------------------------------------------------------------

/** Standard JSON success response with no-store cache. */
export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Standard JSON error response with no-store cache. */
export function jsonError(
  error: string,
  status: number,
  extra?: Record<string, string>
): Response {
  return Response.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "no-store", ...extra },
    }
  );
}

/** 405 Method Not Allowed — no Allow header needed for our use case. */
export function methodNotAllowed(): Response {
  return jsonError("Method not allowed.", 405);
}

// ---------------------------------------------------------------------------
// Error mapper
// ---------------------------------------------------------------------------

/**
 * Maps any error to a safe API response. Typed service errors keep their
 * message; database errors become a generic message. The real error is logged
 * server-side without secrets (connection strings and keys are redacted).
 */
export function handleApiError(err: unknown): Response {
  // ── Expected, typed errors from the service layer ─────────────────
  if (err instanceof UnauthorizedError) {
    return jsonError("Unauthorized. Please log in with a valid access code.", 401);
  }
  if (err instanceof BookingNotFoundError) {
    return jsonError("Booking not found.", 404);
  }
  if (err instanceof DuplicateInvoiceNumberError || err instanceof BookingArchivedError || err instanceof BillUnavailableError) {
    return jsonError(err.message, 409);
  }
  if (err instanceof StaleBookingError) {
    return jsonError(err.message, 412);
  }
  if (err instanceof MissingVersionError) {
    return jsonError(err.message, 428);
  }
  if (err instanceof BookingValidationError) {
    return Response.json(
      { error: err.message, fieldErrors: err.fieldErrors },
      { status: 422, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (err instanceof AccessCodeNotSetError) {
    console.error("[Config]", err.message);
    return jsonError("Sign-in is not configured. Contact the administrator.", 500);
  }
  if (err instanceof EnvConfigError) {
    console.error("[Config]", err.message); // variable names only, never values
    return jsonError("The server is not configured correctly. Contact the administrator.", 500);
  }

  console.error("[API Error]", {
    type: err instanceof Error ? err.constructor.name : typeof err,
    code: err instanceof MongoServerError ? err.code : undefined,
    message: sanitizeLogMessage(err instanceof Error ? err.message : String(err)),
  });

  // ── Database unreachable or slow (network, timeout, no server) → 503, retry
  if (isTemporaryDatabaseError(err)) {
    return jsonError("The database is temporarily unavailable. Please try again in a moment.", 503, {
      "Retry-After": "5",
    });
  }

  // ── Wrong credentials, bad connection string, missing permissions → generic 500
  if (err instanceof MongoParseError || (err instanceof MongoServerError && [13, 18, 8000].includes(Number(err.code)))) {
    return jsonError("Storage is not configured correctly. Contact the administrator.", 500);
  }

  return jsonError("An unexpected error occurred. Please try again.", 500);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isTemporaryDatabaseError(err: unknown): boolean {
  return (
    err instanceof MongoNetworkError ||
    err instanceof MongoServerSelectionError ||
    err instanceof MongoNetworkTimeoutError ||
    err instanceof MongoOperationTimeoutError ||
    (err instanceof MongoError && err.hasErrorLabel("RetryableWriteError"))
  );
}

/**
 * Strips potential secrets from log messages: connection strings, PEM keys
 * and long tokens. Keeps the gist of the error.
 */
export function sanitizeLogMessage(msg: string): string {
  // Redact first, so nothing sensitive survives truncation
  const redacted = msg
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, "[REDACTED_URI]")
    .replace(/-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g, "[REDACTED_KEY]")
    .replace(/[A-Za-z0-9+/=_-]{40,}/g, "[REDACTED]");
  return redacted.length > 500 ? `${redacted.slice(0, 500)}…[truncated]` : redacted;
}
