// lib/domain/field-rules.ts
// Zod rules for the fields every record shares (bookings, expenses, team
// members, list items): dates, free text, phone numbers, whole-rupee amounts,
// record IDs and the restore request. Each schema builds on these,
// so the same input gets the same answer everywhere.

import { z } from "zod";
import { isValidDDMMYYYY } from "./dates";

/**
 * A rule across several fields, as `superRefine` arguments:
 * `schema.superRefine(...crossFieldRule(["a", "b"], check))`. Zod skips an
 * object's refinements while any field has an issue, which hid these errors
 * until every other field was valid; this runs the check as soon as the
 * fields it reads are valid, so its error shows together with the rest.
 */
export function crossFieldRule<T>(fields: readonly (keyof T & string)[], check: (data: T, ctx: z.RefinementCtx) => void) {
  const reads = new Set<string>(fields);
  return [check, { when: ({ issues }: { issues: readonly { path?: readonly PropertyKey[] }[] }) => !issues.some((issue) => reads.has(String(issue.path?.[0]))) }] as const;
}

/** A record's UUID. */
export const recordIdSchema = (label: string) => z.uuid(`Invalid ${label} ID.`);

export const ddmmyyyy = (label: string) =>
  z
    .string()
    .trim()
    .refine(isValidDDMMYYYY, { error: ({ input }) => (input ? `${label} must be a valid date (DD/MM/YYYY).` : `${label} is required.`) });

/**
 * Text that starts with = + - or @ is run as a formula by Excel or Google
 * Sheets if records are ever exported to CSV/a spreadsheet (CSV injection).
 * Such values are refused here, so they are never stored.
 */
const FORMULA_START = /^[=+\-@]/;
const notFormula = (label: string) =>
  [(value: string) => !FORMULA_START.test(value), `${label} can't start with =, +, - or @.`] as const;

/** Required text, trimmed, up to `max` characters. */
export const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`)
    .refine(...notFormula(label));

/** Optional text ("" when empty), trimmed, up to `max` characters. */
export const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .refine(...notFormula(label));

/** An empty number input holds NaN (or nothing): say it's required, not "not a number". */
export const numberError = (label: string) => (issue: { input?: unknown }) =>
  issue.input === undefined || (typeof issue.input === "number" && Number.isNaN(issue.input))
    ? `${label} is required.`
    : `${label} must be a number.`;

/** Whole rupees, from `min` (0 by default) up to ₹100 crore. */
export const rupees = (label: string, min = 0) =>
  z
    .number({ error: numberError(label) })
    .int(`${label} must be in whole rupees.`)
    .min(min, min > 0 ? `${label} must be at least ₹${min}.` : `${label} cannot be negative.`)
    .max(1_00_00_00_000, `${label} is too large.`);

const PHONE = /^[+\d\s\-()]+$/;

/** A required phone number: 7–15 characters of digits, spaces, +, - and brackets. */
export const phoneNumber = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .min(7, `${label} is too short.`)
    .max(15, `${label} is too long.`)
    .regex(PHONE, `${label} may only contain digits, spaces, +, - and brackets.`);

/** An optional phone number: "" or a valid one. */
export const optionalPhone = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || phoneNumber(label).safeParse(value).success, `${label} must be 7–15 digits, spaces, +, - or brackets.`);

/** Restoring an archived record (archiving uses DELETE). */
export const restoreSchema = z.object({ status: z.literal("Active") }).strict();
