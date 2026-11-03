// lib/server/records/rules.ts
// Rules every record's service applies (bookings, expenses, team members, list
// items): validation into field errors, ID and version checks, what a
// versioned write that wrote nothing means, the PATCH that is either a status
// change or an edit, version timestamps that always move forward, and one
// create per idempotency key on this server instance.

import "server-only";

import { z } from "zod";
import { MissingVersionError, NotFoundError, StaleRecordError, ValidationError, type RecordName } from "../errors";

/** Parses with a Zod schema or throws ValidationError (first message per field). */
export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "form";
    fieldErrors[field] ??= issue.message;
  }
  throw new ValidationError(fieldErrors);
}

/** A malformed ID is a record that doesn't exist (404), never a 400 that confirms the format. */
export function assertRecordId(record: RecordName, schema: z.ZodType, id: string): void {
  if (!schema.safeParse(id).success) throw new NotFoundError(record);
}

/** The client must say which version it is changing. */
function assertVersionGiven(record: RecordName, expectedUpdatedAt: string): void {
  if (!expectedUpdatedAt) throw new MissingVersionError(record);
}

/** The version the client saw must still be the stored one. */
export function assertCurrentVersion(record: RecordName, updatedAt: string, expectedUpdatedAt: string): void {
  assertVersionGiven(record, expectedUpdatedAt);
  if (updatedAt !== expectedUpdatedAt) throw new StaleRecordError(record);
}

/** Reads a record's current version (updatedAt), or null if there is no such record. */
type FindVersion = () => Promise<string | null>;

/** A status change needs the version on screen; an unknown record is 404 before a missing version is 428. */
export async function assertVersionFor(record: RecordName, expectedUpdatedAt: string, findVersion: FindVersion): Promise<void> {
  if (expectedUpdatedAt) return;
  if ((await findVersion()) === null) throw new NotFoundError(record);
  throw new MissingVersionError(record);
}

/** A versioned write matched nothing: the record is gone (404), or was changed since it was read (412). */
export async function notWritten(record: RecordName, findVersion: FindVersion): Promise<never> {
  if ((await findVersion()) === null) throw new NotFoundError(record);
  throw new StaleRecordError(record);
}

/**
 * A PATCH body is either a status change on its own (restore; for bookings
 * also cancel / reactivate) or field changes: `statusSchema` tells them apart.
 */
export function statusOrEdit<Status, Result>(
  input: unknown,
  statusSchema: z.ZodType<Status>,
  changes: { status: (status: Status) => Promise<Result>; edit: (input: unknown) => Promise<Result> }
): Promise<Result> {
  const status = statusSchema.safeParse(input);
  return status.success ? changes.status(status.data) : changes.edit(input);
}

/** A timestamp guaranteed to differ from the previous version's (versions must change on every save). */
export function nextTimestamp(previous: string): string {
  const now = new Date();
  const prev = Date.parse(previous);
  return (Number.isFinite(prev) && now.getTime() <= prev ? new Date(prev + 1) : now).toISOString();
}

/**
 * Runs `create` once per idempotency key on this server instance: a repeat
 * that arrives while the first is still saving waits for it and gets the same
 * result (so it never takes a number of its own). The database's unique index
 * on idempotencyKey covers repeats that reach another instance.
 */
export function onePerKey<T>() {
  const inFlight = new Map<string, Promise<T>>();
  return (key: string | undefined, create: () => Promise<T>): Promise<T> => {
    if (!key) return create();
    const running = inFlight.get(key);
    if (running) return running;
    const created = create().finally(() => inFlight.delete(key));
    inFlight.set(key, created);
    return created;
  };
}
