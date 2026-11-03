// components/bookings/booking-form/live-receipt.tsx
// The bill's totals block, updated as the user types (SummaryCard). Preview
// only — the server recalculates every amount when the booking is saved.

"use client";

import { Calculator } from "lucide-react";
import { SummaryCard, SummaryRow, SummaryTotal } from "@/components/forms/summary-card";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatAmount } from "@/lib/domain/money";
import type { AmountPreview } from "@/hooks/use-amount-preview";

export function LiveReceipt({ preview }: { preview: AmountPreview }) {
  const { amounts, problem, travellers, ratePerPerson } = preview;

  return (
    <SummaryCard
      label="Live receipt"
      badge={amounts && <StatusBadge value={amounts.paymentStatus} />}
      words={amounts && { label: "Total amount (in words)", amount: amounts.totalAmount }}
      empty={{ icon: Calculator, message: problem }}
    >
      {amounts && (
        <>
          <SummaryRow label="Gross" detail={`${travellers} × ₹${formatAmount(ratePerPerson)}`}>
            <Money amount={amounts.grossAmount} />
          </SummaryRow>
          <SummaryRow label="Discount" detail={`(${amounts.discountPercentage}%)`}>
            <Money amount={-preview.discountAmount || 0} />
          </SummaryRow>
          <SummaryTotal label="Total amount" amount={amounts.totalAmount} />
          <SummaryRow label="Received">
            <Money amount={Number.isFinite(preview.amountPaid) ? preview.amountPaid : 0} />
          </SummaryRow>
          <SummaryRow label="Balance" strong>
            <Money amount={amounts.balanceAmount} />
          </SummaryRow>
        </>
      )}
    </SummaryCard>
  );
}
