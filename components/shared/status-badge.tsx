// components/shared/status-badge.tsx
// Payment / booking status chip: a dot and a label on a soft fill.

import type { BookingStatus, PaymentStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const TONES: Record<PaymentStatus | BookingStatus, string> = {
  Paid: "bg-status-paid-soft text-status-paid",
  Partial: "bg-status-partial-soft text-status-partial",
  Unpaid: "bg-status-unpaid-soft text-status-unpaid",
  Active: "bg-accent text-accent-foreground",
  Cancelled: "bg-status-neutral-soft text-status-neutral",
  Archived: "bg-status-neutral-soft text-status-neutral",
};

export function StatusBadge({
  status,
  className,
}: {
  status: PaymentStatus | BookingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[status],
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}
