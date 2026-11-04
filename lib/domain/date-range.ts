// lib/domain/date-range.ts
// A list's date-range filter (bookings by trip start and by the day booked,
// expenses by expense date): the range from the URL (?from=YYYY-MM-DD&to=…, never trusted) and the
// quick picks its dropdown offers before "Custom range". Dates are DD/MM/YYYY (UTC
// midnight); "today" is passed in (todayIST()), so the server works the picks
// out and the browser's timezone never shifts them.

import { addDays, addMonths, endOfMonth, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { compareDDMMYYYY, formatDDMMYYYY, parseDDMMYYYY, toISODate } from "./dates";

/** One quick pick: "this-month", "This month", 01/10/2026 – 31/10/2026. */
export interface DatePreset {
  id: string;
  label: string;
  from: string;
  to: string;
}

/** A filter's range, DD/MM/YYYY; "" for an open end. */
export interface DateRange {
  from: string;
  to: string;
}

/** The range as parsed: a start after the end is dropped (both ends), an open end is kept. */
export function orderedRange({ from, to }: DateRange): DateRange {
  return from && to && compareDDMMYYYY(from, to) > 0 ? { from: "", to: "" } : { from, to };
}

/** The range as URL parameters (YYYY-MM-DD; "" when open). */
export const dateRangeParams = ({ from, to }: DateRange) => ({ from: from ? toISODate(from) : "", to: to ? toISODate(to) : "" });

const preset = (label: string, from: Date, to: Date): DatePreset => ({
  id: label.toLowerCase().replace(/\s+/g, "-"),
  label,
  from: formatDDMMYYYY(from),
  to: formatDDMMYYYY(to),
});

/** The quick pick a range is exactly (its dropdown shows it), or undefined (a custom range, or none). */
export const presetOf = (presets: readonly DatePreset[], { from, to }: DateRange) => presets.find((p) => p.from === from && p.to === to);

/** Monday to Sunday of the week holding `date`. */
const weekOf = (date: Date) => {
  const monday = subDays(date, (date.getUTCDay() + 6) % 7);
  return [monday, addDays(monday, 6)] as const;
};

/** The bookings list's picks, by trip start: mostly trips ahead. */
export function tripDatePresets(today: string): DatePreset[] {
  const t = parseDDMMYYYY(today)!;
  const next = startOfMonth(addMonths(t, 1));
  const last = startOfMonth(subMonths(t, 1));
  return [
    preset("This week", ...weekOf(t)),
    preset("This month", startOfMonth(t), endOfMonth(t)),
    preset("Next month", next, endOfMonth(next)),
    preset("Next 3 months", next, endOfMonth(addMonths(next, 2))),
    preset("Last month", last, endOfMonth(last)),
  ];
}

/** Picks that stop at today, for dates that can't be ahead: an expense's date, the day a booking was made. */
export function pastDatePresets(today: string): DatePreset[] {
  const t = parseDDMMYYYY(today)!;
  const last = startOfMonth(subMonths(t, 1));
  const lastYear = startOfYear(subDays(startOfYear(t), 1));
  return [
    preset("Today", t, t),
    preset("Yesterday", subDays(t, 1), subDays(t, 1)),
    preset("Last 7 days", subDays(t, 6), t),
    preset("This month", startOfMonth(t), t),
    preset("Last month", last, endOfMonth(last)),
    preset("This year", startOfYear(t), t),
    preset("Last year", lastYear, subDays(startOfYear(t), 1)),
  ];
}
