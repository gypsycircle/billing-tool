// lib/domain/booking.schema.ts
// Zod schemas for bookings — shared by the booking form (client), the API
// (server) and the database layer, so every layer enforces the same rules.
// Text length limits are hard caps. Whether a value fits its field on the
// Bill of Supply is measured at save time by the booking service (lib/server/pdf).

import { z } from "zod";
import type { BookingDraft, BookingInput } from "./types";
import { addDays, compareDDMMYYYY, isValidDDMMYYYY } from "./dates";

// ---------------------------------------------------------------------------
// Field rules
// ---------------------------------------------------------------------------

export const bookingIdSchema = z.uuid("Invalid booking ID.");

const ddmmyyyy = (label: string) =>
  z
    .string()
    .trim()
    .refine(isValidDDMMYYYY, `${label} must be a valid date (DD/MM/YYYY).`);

/**
 * Text that starts with = + - or @ is run as a formula by Excel or Google
 * Sheets if bookings are ever exported to CSV/a spreadsheet (CSV injection).
 * Such values are refused here, so they are never stored.
 */
const FORMULA_START = /^[=+\-@]/;
const notFormula = (label: string) =>
  [(value: string) => !FORMULA_START.test(value), `${label} can't start with =, +, - or @.`] as const;

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`)
    .refine(...notFormula(label));

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .refine(...notFormula(label));

/** Optional customer email: "" or a valid address, stored lowercased. */
const optionalEmail = z
  .string()
  .trim()
  .max(254, "Email must be at most 254 characters.")
  .transform((value) => value.toLowerCase())
  .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.");

const rupees = (label: string) =>
  z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be in whole rupees.`)
    .nonnegative(`${label} cannot be negative.`)
    .max(1_00_00_00_000, `${label} is too large.`);

// ---------------------------------------------------------------------------
// Booking input
// ---------------------------------------------------------------------------

const bookingInputSchema = z.object({
  invoiceNumber: z
    .string()
    .trim()
    .min(1, "Invoice number is required.")
    .max(20, "Invoice number must be at most 20 characters.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9_\-/]*$/, "Invoice number must start with a letter or digit and may contain _, - and /."),
  invoiceDate: ddmmyyyy("Invoice date"),
  dueDate: ddmmyyyy("Due date"),
  customerName: text("Customer name", 100),
  customerPhone: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .min(7, "Mobile number is too short.")
    .max(15, "Mobile number is too long.")
    .regex(/^[+\d\s\-()]+$/, "Mobile number may only contain digits, spaces, +, - and brackets."),
  customerEmail: optionalEmail,
  packageName: text("Package name", 150),
  destination: text("Destination", 100),
  batchName: text("Batch name", 100),
  tripStartDate: ddmmyyyy("Trip start date"),
  tripEndDate: ddmmyyyy("Trip end date"),
  routeDescription: optionalText("Route description", 200),
  travellers: z
    .number({ error: "Travellers must be a number." })
    .int("Travellers must be a whole number.")
    .min(1, "Travellers must be at least 1.")
    .max(10_000, "Travellers is too large."),
  ratePerPerson: rupees("Rate per person"),
  discountAmount: rupees("Discount"),
  amountPaid: rupees("Amount paid"),
  invoiceNote: optionalText("Invoice note", 300),
  internalNotes: optionalText("Internal notes", 500),
}) satisfies z.ZodType<BookingInput>;

// Zod still runs refinements when a field already failed, so only compare valid dates.
const isBefore = (a: string, b: string) =>
  isValidDDMMYYYY(a) && isValidDDMMYYYY(b) && compareDDMMYYYY(a, b) < 0;

/** Rules that span more than one of the fields the user enters. */
function checkDraftRules(data: BookingDraft, ctx: z.RefinementCtx): void {
  const amountsValid =
    [data.travellers, data.ratePerPerson, data.discountAmount, data.amountPaid].every(
      (n) => Number.isSafeInteger(n) && n >= 0
    ) && data.travellers >= 1;
  const gross = data.travellers * data.ratePerPerson;

  if (!amountsValid) {
    // Field-level errors already explain the problem.
  } else if (data.discountAmount > gross) {
    ctx.addIssue({
      code: "custom",
      path: ["discountAmount"],
      message: "Discount cannot exceed the gross amount.",
    });
  } else if (data.amountPaid > gross - data.discountAmount) {
    ctx.addIssue({
      code: "custom",
      path: ["amountPaid"],
      message: "Amount paid cannot exceed the total amount.",
    });
  }

  if (isBefore(data.tripEndDate, data.tripStartDate)) {
    ctx.addIssue({
      code: "custom",
      path: ["tripEndDate"],
      message: "Trip end date cannot be before the start date.",
    });
  }
}

/** Every rule for a complete booking, including the assigned dates. */
function checkCrossFieldRules(data: BookingInput, ctx: z.RefinementCtx): void {
  checkDraftRules(data, ctx);
  if (isBefore(data.dueDate, data.invoiceDate)) {
    ctx.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Due date cannot be before the invoice date.",
    });
  }
}

/**
 * A trip must start after its invoice date (from the next day on). Checked
 * when the trip start is entered or changed, so older bookings stay editable.
 * Returns the message, or null when the start is fine (or not a valid date yet).
 */
export function tripStartIssue(tripStartDate: string, invoiceDate: string): string | null {
  return afterInvoiceIssue(tripStartDate, invoiceDate, "start");
}

/** Same rule for the trip end: from the day after the invoice date. */
export function tripEndIssue(tripEndDate: string, invoiceDate: string): string | null {
  return afterInvoiceIssue(tripEndDate, invoiceDate, "end");
}

function afterInvoiceIssue(date: string, invoiceDate: string, word: "start" | "end"): string | null {
  if (!isValidDDMMYYYY(date) || !isValidDDMMYYYY(invoiceDate)) return null;
  if (compareDDMMYYYY(date, invoiceDate) > 0) return null;
  return `Trip must ${word} after the invoice date (from ${addDays(invoiceDate, 1)} onwards).`;
}

/** A complete booking (the stored record): every field, plus cross-field rules. */
export const createBookingSchema = bookingInputSchema.superRefine(checkCrossFieldRules);

const bookingDraftObject = bookingInputSchema.omit({ invoiceNumber: true, invoiceDate: true, dueDate: true });

/**
 * Create: what the user enters. The server assigns the invoice number and
 * dates (any sent are dropped) and validates the full record afterwards.
 */
export const bookingDraftSchema = bookingDraftObject.superRefine(checkDraftRules);

/**
 * The booking form: the draft plus "trip starts and ends after the invoice
 * date". `saved` (edit) skips a rule while that stored date is unchanged.
 * Runs even while other fields are still empty (`when`), so the message shows
 * as soon as a trip date is entered.
 */
export function bookingFormSchema(
  invoiceDate: string,
  saved: { tripStartDate?: string; tripEndDate?: string } = {}
) {
  return bookingDraftSchema.superRefine(
    (data, ctx) => {
      if (data.tripStartDate !== saved.tripStartDate) {
        const message = tripStartIssue(data.tripStartDate, invoiceDate);
        if (message) ctx.addIssue({ code: "custom", path: ["tripStartDate"], message });
      }
      if (data.tripEndDate !== saved.tripEndDate) {
        const message = tripEndIssue(data.tripEndDate, invoiceDate);
        if (message) ctx.addIssue({ code: "custom", path: ["tripEndDate"], message });
      }
    },
    {
      when: ({ value }) => {
        const v = value as { tripStartDate?: unknown; tripEndDate?: unknown } | null;
        return typeof v?.tripStartDate === "string" && typeof v?.tripEndDate === "string";
      },
    }
  );
}

/**
 * Update: any subset of the fields the user enters, unknown keys (including
 * the invoice number and dates) rejected. The service merges the update onto
 * the stored booking and re-validates with createBookingSchema.
 */
export const updateBookingSchema = bookingDraftObject
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "No changes were provided.");

/** A status-only change: cancel, reactivate or restore (archiving uses DELETE). */
export const statusChangeSchema = z
  .object({ bookingStatus: z.enum(["Active", "Cancelled"]) })
  .strict();
