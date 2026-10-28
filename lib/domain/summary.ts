// lib/domain/summary.ts
// The dashboard's figures, as the database works them out (lib/server/db/ledger-query.ts).
// Summary figures count ACTIVE bookings only (cancelled and archived excluded).

export interface LedgerSummary {
  activeCount: number;
  /** Sum of balances still owed. */
  outstanding: number;
  /** Sum of amounts received so far. */
  collected: number;
  /** Bookings with a balance whose due date is today … today + DUE_SOON_DAYS. */
  dueSoonCount: number;
  dueSoonAmount: number;
  /** Bookings with a balance whose due date has passed. */
  overdueCount: number;
}

/** Count and totals of the bookings matching the ledger's filters, across all pages. */
export interface LedgerTotals {
  count: number;
  total: number;
  received: number;
  balance: number;
  /** The active ones among them (the totals row counts these, except in the archived view). */
  activeCount: number;
  activeTotal: number;
  activeReceived: number;
  activeBalance: number;
}

/** Days ahead that count as "due soon" (the "Due in 7 days" figure and filter). */
export const DUE_SOON_DAYS = 7;

/** The due filter: "overdue" (an active booking with a balance, due date passed) or "week" (due today … today + DUE_SOON_DAYS). */
export type DueBucket = "overdue" | "week";
