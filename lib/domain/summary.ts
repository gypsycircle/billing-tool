// lib/domain/summary.ts
// The dashboard's figures, as the database works them out (lib/server/db/ledger-query.ts).
// Summary figures count ACTIVE bookings, plus the money kept and refunds owed on
// cancelled ones (archived excluded).

export interface LedgerSummary {
  activeCount: number;
  /** Total travellers (pax) across the active bookings. */
  activeTravellers: number;
  /** Sum of balances still owed. */
  outstanding: number;
  /** Received on active bookings, plus what cancelled ones keep (received − refund). */
  collected: number;
  /** Refunds on cancelled bookings not yet paid. */
  refundsDueCount: number;
  refundsDueAmount: number;
  /** Bookings with a balance whose due date is tomorrow … today + DUE_SOON_DAYS. */
  dueSoonCount: number;
  dueSoonAmount: number;
  /** Bookings with a balance whose due date is today or earlier (the trip is 14 days away or less). */
  overdueCount: number;
}

/** Count and totals of the bookings matching the ledger's filters, across all pages. */
export interface LedgerTotals {
  count: number;
  total: number;
  received: number;
  balance: number;
  /** The active ones among them. */
  activeCount: number;
  /** The active ones' totals, plus what the cancelled ones keep. */
  activeTotal: number;
  /** Received on the active ones, plus what the cancelled ones keep. */
  activeReceived: number;
  activeBalance: number;
  /** Refunds that have gone back. */
  refunded: number;
  /** Every refund's amount, gone back or still due. */
  refundTotal: number;
}

/** Days ahead that count as "due soon" (the "Due in 7 days" figure and filter). */
export const DUE_SOON_DAYS = 7;

/** The due filter, for active bookings with a balance: "overdue" (due today or earlier) or "week" (due tomorrow … today + DUE_SOON_DAYS). */
export type DueBucket = "overdue" | "week";
