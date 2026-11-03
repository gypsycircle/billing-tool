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

/** A wrong access code at sign-in — maps to 401 "Invalid access code.". */
export class InvalidAccessCodeError extends Error {
  constructor() {
    super("Invalid access code.");
    this.name = "InvalidAccessCodeError";
  }
}

/** Too many sign-in attempts from this client (or overall) — maps to 429 with Retry-After. */
export class TooManyAttemptsError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many login attempts. Please try again later.");
    this.name = "TooManyAttemptsError";
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

/** The kind of record an error is about, as users read it: "booking", "team member". */
export type RecordName = "booking" | "expense" | "team member" | "list item" | "history entry";

const capitalised = (record: RecordName) => record[0].toUpperCase() + record.slice(1);

/** The record's ID is malformed or it does not exist — maps to 404. */
export class NotFoundError extends Error {
  constructor(readonly record: RecordName) {
    super(`${capitalised(record)} not found.`);
    this.name = "NotFoundError";
  }
}

/** A record's number is already used by another record — maps to 409. */
export class DuplicateNumberError extends Error {
  constructor(record: RecordName, label: string, number: string) {
    super(`${label} ${number} is already used by another ${record}. Please try again.`);
    this.name = "DuplicateNumberError";
  }
}

/** A team member or list item with that name already exists (in that list) — maps to 409. */
export class DuplicateNameError extends Error {
  constructor(what: string, name: string) {
    super(`There is already a ${what} called "${name}". Use that one, or restore it if it is archived.`);
    this.name = "DuplicateNameError";
  }
}

/**
 * The record changed after the user loaded it (another person saved first).
 * Maps to 412 — the user must reload instead of silently overwriting.
 */
export class StaleRecordError extends Error {
  constructor(record: RecordName) {
    super(
      `This ${record} was changed by someone else after you opened it. Reload to see the latest version — your changes were not saved.`
    );
    this.name = "StaleRecordError";
  }
}

/** The client didn't say which version it is changing (missing X-Record-Version) — maps to 428. */
export class MissingVersionError extends Error {
  constructor(record: RecordName) {
    super(`Reload the ${record} and try again.`);
    this.name = "MissingVersionError";
  }
}

/** Archived records are read-only until restored — maps to 409. */
export class ArchivedRecordError extends Error {
  constructor(record: RecordName) {
    super(`Archived ${record}s can't be changed. Restore it first.`);
    this.name = "ArchivedRecordError";
  }
}

/** A cancellation or refund rule refused the change; the message says what to do — maps to 409. */
export class BookingRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingRuleError";
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
export class ValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors)[0] ?? "Invalid input.");
    this.name = "ValidationError";
  }
}
