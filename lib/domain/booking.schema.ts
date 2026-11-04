// lib/domain/booking.schema.ts
// Zod schemas for bookings — shared by the booking form (client), the API
// (server) and the database layer, so every layer enforces the same rules.
// Text length limits are hard caps. Whether a value fits its field on the
// Bill of Supply is measured at save time by the booking service (lib/server/pdf).

import { z } from "zod";
import { PACKAGE_TYPES, type BookingDraft, type BookingInput } from "./types";
import { addDays, compareDDMMYYYY, isValidDDMMYYYY } from "./dates";
import { crossFieldRule, ddmmyyyy, numberError, optionalText, phoneNumber, recordIdSchema, rupees, text } from "./field-rules";
import { flag } from "./filters";
import { ROUTE_OTHER } from "./general";

// ---------------------------------------------------------------------------
// Field rules (shared ones in field-rules.ts)
// ---------------------------------------------------------------------------

export const bookingIdSchema = recordIdSchema("booking");

/** Optional customer email: "" or a valid address, stored lowercased. */
const optionalEmail = z
  .string()
  .trim()
  .max(254, "Email must be at most 254 characters.")
  .transform((value) => value.toLowerCase())
  .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.");

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
  customerPhone: phoneNumber("Mobile number"),
  customerEmail: optionalEmail,
  packageName: text("Package name", 150),
  packageType: z.enum(PACKAGE_TYPES, { error: "Choose the package type." }),
  destination: text("Destination", 100),
  batchName: text("Batch name", 100),
  tripStartDate: ddmmyyyy("Trip start date"),
  tripEndDate: ddmmyyyy("Trip end date"),
  routeDescription: text("Route", 200),
  travellers: z
    .number({ error: numberError("Travellers") })
    .int("Travellers must be a whole number.")
    .min(1, "Travellers must be at least 1.")
    .max(10_000, "Travellers is too large."),
  ratePerPerson: rupees("Rate per person"),
  discountAmount: rupees("Discount"),
  amountPaid: rupees("Amount paid"),
  slotAmount: rupees("Slot amount"),
  invoiceNote: optionalText("Invoice note", 300),
  internalNotes: optionalText("Internal notes", 500),
}) satisfies z.ZodType<BookingInput>;

// Each rule runs once the fields it reads are valid (crossFieldRule), so it
// shows together with any other field's error.
const isBefore = (a: string, b: string) => isValidDDMMYYYY(a) && isValidDDMMYYYY(b) && compareDDMMYYYY(a, b) < 0;

/** The discount fits the gross amount; the amount paid and the slot amount fit the total. */
const amountsRule = crossFieldRule<BookingDraft>(["travellers", "ratePerPerson", "discountAmount", "amountPaid", "slotAmount"], (data, ctx) => {
  const gross = data.travellers * data.ratePerPerson;
  if (data.discountAmount > gross) {
    ctx.addIssue({ code: "custom", path: ["discountAmount"], message: "Discount cannot exceed the gross amount." });
  } else if (data.amountPaid > gross - data.discountAmount) {
    ctx.addIssue({ code: "custom", path: ["amountPaid"], message: "Amount paid cannot exceed the total amount." });
  } else if (data.slotAmount > gross - data.discountAmount) {
    ctx.addIssue({ code: "custom", path: ["slotAmount"], message: "Slot amount cannot exceed the total amount." });
  }
});

/** A private package never has a slot amount. */
const privateSlotRule = crossFieldRule<Pick<BookingDraft, "packageType" | "slotAmount">>(["packageType", "slotAmount"], (data, ctx) => {
  if (data.packageType === "Private" && data.slotAmount !== 0) {
    ctx.addIssue({ code: "custom", path: ["slotAmount"], message: "A private package has no slot amount." });
  }
});

/** The trip ends on or after its start. */
const tripOrderRule = crossFieldRule<BookingDraft>(["tripStartDate", "tripEndDate"], (data, ctx) => {
  if (isBefore(data.tripEndDate, data.tripStartDate)) {
    ctx.addIssue({ code: "custom", path: ["tripEndDate"], message: "Trip end date cannot be before the start date." });
  }
});

/** The due date isn't before the invoice date (the dates the server assigns). */
const dueDateRule = crossFieldRule<BookingInput>(["dueDate", "invoiceDate"], (data, ctx) => {
  if (isBefore(data.dueDate, data.invoiceDate)) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Due date cannot be before the invoice date." });
  }
});

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
export const createBookingSchema = bookingInputSchema
  .superRefine(...amountsRule)
  .superRefine(...privateSlotRule)
  .superRefine(...tripOrderRule)
  .superRefine(...dueDateRule);

/** The dates a new booking can have, newest first: today, yesterday, the day before. */
export const invoiceDateChoices = (today: string): string[] => [today, addDays(today, -1), addDays(today, -2)];

/** A new booking is dated one of those. Returns the message, or null when the date is fine (or not a valid date yet). */
export function invoiceDateIssue(invoiceDate: string, today: string): string | null {
  if (!isValidDDMMYYYY(invoiceDate) || invoiceDateChoices(today).includes(invoiceDate)) return null;
  return "Invoice date must be today, yesterday or the day before.";
}

/** The most a new or changed bill note can hold, so it stays readable with the seal under it on a cancelled bill. */
export const BILL_NOTE_MAX_WORDS = 25;
export const BILL_NOTE_MAX_LINES = 3;

/** A note's words and printed lines: the lines typed, blank ones aside. */
export function billNoteCounts(note: string): { words: number; lines: number } {
  const text = note.trim();
  return { words: text ? text.split(/\s+/).length : 0, lines: text.split(/\r?\n/).filter((line) => line.trim()).length };
}

function checkBillNote(note: string, ctx: z.RefinementCtx): void {
  const { words, lines } = billNoteCounts(note);
  if (words > BILL_NOTE_MAX_WORDS) ctx.addIssue({ code: "custom", path: ["invoiceNote"], message: `Keep the invoice note to ${BILL_NOTE_MAX_WORDS} words (it has ${words}).` });
  else if (lines > BILL_NOTE_MAX_LINES) ctx.addIssue({ code: "custom", path: ["invoiceNote"], message: `Keep the invoice note to ${BILL_NOTE_MAX_LINES} lines (it has ${lines}).` });
}

/** "Other" on the Route dropdown needs the route typed in. */
function routeOtherIssue(data: { routeDescription?: string; routeOther?: string }, ctx: z.RefinementCtx) {
  if (data.routeDescription === ROUTE_OTHER && !data.routeOther) ctx.addIssue({ code: "custom", path: ["routeOther"], message: "Type the route." });
}

const routeOtherRule = crossFieldRule<{ routeDescription: string; routeOther: string }>(["routeDescription", "routeOther"], routeOtherIssue);

const billNoteRule = crossFieldRule<Pick<BookingDraft, "invoiceNote">>(["invoiceNote"], (data, ctx) => checkBillNote(data.invoiceNote, ctx));

const bookingEditableObject = bookingInputSchema
  .omit({ invoiceNumber: true, invoiceDate: true, dueDate: true })
  .extend({
    closedById: z.uuid("Choose who closed this booking."),
    routeOther: optionalText("Route", 200),
  });

/**
 * Create: what the user enters, including the invoice date. The server assigns
 * the invoice number and due date (any sent are dropped), and validates the
 * full record afterwards.
 */
const draftWithoutNoteLimit = bookingEditableObject
  .extend({ invoiceDate: ddmmyyyy("Invoice date"), routeOther: bookingEditableObject.shape.routeOther.default("") })
  .superRefine(...routeOtherRule)
  .superRefine(...amountsRule)
  .superRefine(...privateSlotRule)
  .superRefine(...tripOrderRule);

export const bookingDraftSchema = draftWithoutNoteLimit.superRefine(...billNoteRule);

type BookingFormDates = Pick<BookingInput, "invoiceDate" | "tripStartDate" | "tripEndDate">;

/**
 * The booking form: the draft plus "trip starts and ends after the invoice
 * date". `saved` (edit) skips a rule while that stored value is unchanged (an older note can be over the limit);
 * `today` (create) adds the rule on the invoice date.
 */
export function bookingFormSchema({ saved = {}, today }: { saved?: { tripStartDate?: string; tripEndDate?: string; invoiceNote?: string }; today?: string } = {}) {
  const afterInvoice = (field: "tripStartDate" | "tripEndDate", issue: typeof tripStartIssue) =>
    crossFieldRule<BookingFormDates>([field, "invoiceDate"], (data, ctx) => {
      if (data[field] === saved[field]) return;
      const message = issue(data[field], data.invoiceDate);
      if (message) ctx.addIssue({ code: "custom", path: [field], message });
    });
  const invoiceDateRule = crossFieldRule<BookingFormDates>(["invoiceDate"], (data, ctx) => {
    const message = today ? invoiceDateIssue(data.invoiceDate, today) : null;
    if (message) ctx.addIssue({ code: "custom", path: ["invoiceDate"], message });
  });
  const noteRule = crossFieldRule<Pick<BookingDraft, "invoiceNote">>(["invoiceNote"], (data, ctx) => {
    if (data.invoiceNote !== saved.invoiceNote) checkBillNote(data.invoiceNote, ctx);
  });
  return draftWithoutNoteLimit
    .superRefine(...noteRule)
    .superRefine(...invoiceDateRule)
    .superRefine(...afterInvoice("tripStartDate", tripStartIssue))
    .superRefine(...afterInvoice("tripEndDate", tripEndIssue));
}

/**
 * Update: any subset of the fields the user enters, unknown keys (including
 * the invoice number and dates) rejected. The service merges the update onto
 * the stored booking and re-validates with createBookingSchema.
 */
export const updateBookingSchema = bookingEditableObject
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "No changes were provided.")
  .superRefine((data, ctx) => {
    if (data.invoiceNote !== undefined) checkBillNote(data.invoiceNote, ctx);
    routeOtherIssue(data, ctx);
  });

/** GET /api/bookings/[id]/pdf's query: ?inline=1 opens the bill in the browser instead of downloading it. */
export const parseBillQuery = (query: Record<string, string | string[] | undefined>) => ({ inline: flag.parse(query.inline) });

/** A status-only change: cancel, reactivate or restore (archiving uses DELETE). */
export const statusChangeSchema = z.union([
  z.object({ bookingStatus: z.literal("Active") }).strict(),
  z.object({ bookingStatus: z.literal("Cancelled"), refundAmount: rupees("Refund amount").optional() }).strict(),
]);

/** A cancelled booking's refund: its amount, or whether it has gone back (the server dates it). */
export const refundChangeSchema = z.union([
  z.object({ refundAmount: rupees("Refund amount") }).strict(),
  z.object({ refundPaid: z.boolean() }).strict(),
]);
