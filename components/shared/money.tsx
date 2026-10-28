// components/shared/money.tsx
// Whole rupees with Indian grouping and tabular figures: ₹3,50,000.

import { formatAmount } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

export function Money({
  amount,
  className,
  showSymbol = true,
}: {
  amount: number;
  className?: string;
  showSymbol?: boolean;
}) {
  const negative = amount < 0;
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {negative && "−"}
      {showSymbol && <span className="mr-0.5 text-[0.85em] font-normal opacity-70">₹</span>}
      {formatAmount(Math.abs(amount))}
    </span>
  );
}
