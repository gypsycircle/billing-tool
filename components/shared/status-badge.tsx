// components/shared/status-badge.tsx
// The one badge for every status and kind (payment, trip, record, an
// expense's kind): a dot and a label, coloured by the value itself, so no
// caller picks a colour. Each value's look is decided once, in BADGES:
//   Paid / Partial / Unpaid   green / ochre / red: done, in progress, owed
//   Active                    teal wash (accent): live
//   Cancelled                 muted grey fill: the trip is off, the record is kept
//   Archived                  slate outline, no fill: put away (shape, not only colour, sets it apart)
//   Spent                     green, like Paid: an expense that isn't archived
//   Direct / Indirect         indigo, both: categories, in a hue no status uses
// The dot and the label carry the meaning too, never the colour alone.

import type { ExpenseKind } from "@/lib/domain/expenses";
import { EXPENSE_KINDS } from "@/lib/domain/expenses";
import type { ArchivableStatus } from "@/lib/domain/records";
import type { RefundStatus } from "@/lib/domain/refunds";
import type { BookingStatus, PaymentStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export type BadgeValue = PaymentStatus | BookingStatus | ArchivableStatus | ExpenseKind | RefundStatus | "Spent";

/** Every value's look. Typed from the domain's lists: a new status without one fails the type check. */
const BADGES: Record<BadgeValue, string> = {
  Paid: "bg-status-paid-soft text-status-paid",
  Partial: "bg-status-partial-soft text-status-partial",
  Unpaid: "bg-status-unpaid-soft text-status-unpaid",
  // Money still owed is red and settled is green, whichever way it's owed
  "Refund due": "bg-status-unpaid-soft text-status-unpaid",
  Refunded: "bg-status-paid-soft text-status-paid",
  Spent: "bg-status-paid-soft text-status-paid",
  "No refund": "bg-muted text-muted-foreground",
  Active: "bg-accent text-accent-foreground",
  Cancelled: "bg-muted text-muted-foreground",
  Archived: "border-dashed border-status-neutral/60 text-status-neutral",
  direct: "bg-tag-direct-soft text-tag-direct",
  indirect: "bg-tag-direct-soft text-tag-direct",
};

/** The text shown: a status as it is, a kind by its name ("direct" → "Direct"). */
const labelOf = (value: BadgeValue): string => (value in EXPENSE_KINDS ? EXPENSE_KINDS[value as ExpenseKind] : value);

/** Every badge has a border (clear but for Archived), so all are the same size. */
export function StatusBadge({ value, className }: { value: BadgeValue; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap", BADGES[value], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {labelOf(value)}
    </span>
  );
}
