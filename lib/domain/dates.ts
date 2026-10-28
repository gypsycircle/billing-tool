// lib/domain/dates.ts
// The app's date rules, on top of date-fns. All booking dates are stored and
// printed as DD/MM/YYYY and handled as UTC midnight (UTCDate), so results
// never depend on the server's or browser's timezone. "Today" is always the
// date in India (Asia/Kolkata).

import { addDays as shiftDays, compareAsc, format, isValid, max, parse, subDays } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { UTCDate } from "@date-fns/utc";

const DDMMYYYY = "dd/MM/yyyy";
const ISO_DATE = "yyyy-MM-dd";
const IST = "Asia/Kolkata";

/** date-fns parsing is lenient about digit counts; the app only accepts the exact shape. */
const EXACT_DDMMYYYY = /^\d{2}\/\d{2}\/\d{4}$/;
const EXACT_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseUTC(value: string, pattern: string, shape: RegExp): Date | null {
  const text = value.trim();
  if (!shape.test(text)) return null;
  const date = parse(text, pattern, new UTCDate(0));
  return isValid(date) ? date : null;
}

/** Parses DD/MM/YYYY into a UTC-midnight Date, or null if not a real calendar date. */
export function parseDDMMYYYY(value: string): Date | null {
  return parseUTC(value, DDMMYYYY, EXACT_DDMMYYYY);
}

export function isValidDDMMYYYY(value: string): boolean {
  return parseDDMMYYYY(value) !== null;
}

/** Formats a UTC-midnight Date as DD/MM/YYYY. */
export function formatDDMMYYYY(date: Date): string {
  return format(new UTCDate(date), DDMMYYYY);
}

/** Today's date in India (Asia/Kolkata) as DD/MM/YYYY. */
export function todayIST(now: Date = new Date()): string {
  return format(new TZDate(now, IST), DDMMYYYY);
}

/** Adds (or subtracts) whole days. Returns "" for an invalid input date. */
export function addDays(value: string, days: number): string {
  const date = parseDDMMYYYY(value);
  return date ? format(shiftDays(date, days), DDMMYYYY) : "";
}

/** Negative if a < b, 0 if equal, positive if a > b. Both must be valid. */
export function compareDDMMYYYY(a: string, b: string): number {
  const da = parseDDMMYYYY(a);
  const db = parseDDMMYYYY(b);
  if (!da || !db) throw new Error("compareDDMMYYYY: invalid date");
  return compareAsc(da, db);
}

/** Trip date as written on the bill, e.g. "19/01/2026" → "19th jan 2026". */
export function formatTripDate(value: string): string {
  const date = parseDDMMYYYY(value);
  return date ? format(date, "do MMM yyyy").toLowerCase() : "";
}

/** Short date for the app's screens, e.g. "19/01/2026" → "19 Jan 2026". */
export function formatDisplayDate(value: string): string {
  const date = parseDDMMYYYY(value);
  return date ? format(date, "d MMM yyyy") : value;
}

/** An ISO timestamp shown in India time, e.g. "13 Jan 2026, 3:42 pm". "" if invalid. */
export function formatTimestampIST(iso: string): string {
  const date = new Date(iso);
  if (!iso || !isValid(date)) return "";
  return format(new TZDate(date, IST), "d MMM yyyy, h:mm aaa");
}

/**
 * Default due date: 14 days before the trip starts (the T&C requires full
 * payment two weeks before departure), but never earlier than the invoice date.
 */
export function defaultDueDate(tripStartDate: string, invoiceDate: string): string {
  const tripStart = parseDDMMYYYY(tripStartDate);
  const invoice = parseDDMMYYYY(invoiceDate);
  if (!tripStart || !invoice) return invoiceDate;
  return format(max([subDays(tripStart, 14), invoice]), DDMMYYYY);
}

/** DD/MM/YYYY → YYYY-MM-DD (for <input type="date">). */
export function toISODate(value: string): string {
  const date = parseDDMMYYYY(value);
  return date ? format(date, ISO_DATE) : "";
}

/** YYYY-MM-DD → DD/MM/YYYY. Returns "" if invalid. */
export function fromISODate(iso: string): string {
  const date = parseUTC(iso, ISO_DATE, EXACT_ISO_DATE);
  return date ? format(date, DDMMYYYY) : "";
}
