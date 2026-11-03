// lib/domain/records.ts
// What every editable record (booking, expense, team member, list item) shares.

/**
 * Request header carrying the version (updatedAt) the user is changing, on
 * PATCH and DELETE. Not If-Match: that standard header is enforced by Vercel's
 * edge as an ETag precondition, which answers 412 before the app runs.
 */
export const RECORD_VERSION_HEADER = "X-Record-Version";

/** Header that makes a create safe to retry: a repeat returns the first record. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Records that are soft-deleted: expenses, team members, list items. Archived ones are hidden, never removed. */
export const ARCHIVABLE_STATUSES = ["Active", "Archived"] as const;
export type ArchivableStatus = (typeof ARCHIVABLE_STATUSES)[number];

/** True for an archived record, whichever field holds its status (a booking's bookingStatus, the rest's status). */
export const isArchived = (record: { status: string } | { bookingStatus: string }): boolean =>
  ("bookingStatus" in record ? record.bookingStatus : record.status) === "Archived";
