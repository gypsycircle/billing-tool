// lib/server/errors.ts
// Typed errors thrown by the service layer. handleApiError (http/respond.ts)
// maps each one to an HTTP status and a safe, user-facing message.

import "server-only";

/** No valid session — maps to 401. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Sign-in is impossible: no access code hash is stored, or it is malformed.
 * Maps to a generic 500; the reason is logged for the administrator.
 */
export class AccessCodeNotSetError extends Error {
  constructor(reason: string) {
    super(`${reason}. Set it with: node --env-file=.env.local scripts/set-access-code.mjs`);
    this.name = "AccessCodeNotSetError";
  }
}

/** Booking ID is malformed or does not exist — maps to 404. */
export class BookingNotFoundError extends Error {
  constructor() {
    super("Booking not found.");
    this.name = "BookingNotFoundError";
  }
}

/** Invoice number already used by another booking — maps to 409. */
export class DuplicateInvoiceNumberError extends Error {
  constructor(readonly invoiceNumber: string) {
    super(`Invoice number ${invoiceNumber} is already used by another booking. Please try again.`);
    this.name = "DuplicateInvoiceNumberError";
  }
}

/**
 * The booking changed after the user loaded it (another person saved first).
 * Maps to 412 — the user must reload instead of silently overwriting.
 */
export class StaleBookingError extends Error {
  constructor() {
    super(
      "This booking was changed by someone else after you opened it. Reload to see the latest version — your changes were not saved."
    );
    this.name = "StaleBookingError";
  }
}

/** The client didn't say which version it is changing (missing If-Match) — maps to 428. */
export class MissingVersionError extends Error {
  constructor() {
    super("Reload the booking and try again.");
    this.name = "MissingVersionError";
  }
}

/** Archived bookings are read-only until restored — maps to 409. */
export class BookingArchivedError extends Error {
  constructor() {
    super("Archived bookings can't be changed. Restore it first.");
    this.name = "BookingArchivedError";
  }
}

/** Archived bookings have no bill until restored — maps to 409. */
export class BillUnavailableError extends Error {
  constructor() {
    super("Archived bookings have no bill. Restore the booking to download it.");
    this.name = "BillUnavailableError";
  }
}

/** Input failed validation — maps to 422 with per-field messages. */
export class BookingValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors)[0] ?? "Invalid booking.");
    this.name = "BookingValidationError";
  }
}
