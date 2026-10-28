// components/bookings/booking-form/live-receipt.tsx
// The bill's totals block, updated as the user types. Preview only — the
// server recalculates every amount when the booking is saved.

"use client";

import { Calculator } from "lucide-react";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { amountToWords } from "@/lib/domain/words";
import { formatAmount } from "@/lib/domain/money";
import type { AmountPreview } from "@/hooks/use-amount-preview";

function Row({ label, detail, children, strong }: { label: string; detail?: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
        {detail && <span className="ml-1.5 text-xs text-muted-foreground tabular">{detail}</span>}
      </dt>
      <dd className={strong ? "font-semibold" : undefined}>{children}</dd>
    </div>
  );
}

export function LiveReceipt({ preview }: { preview: AmountPreview }) {
  const { amounts, problem, travellers, ratePerPerson } = preview;

  return (
    <section aria-label="Live receipt" className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center justify-between border-b px-5 py-3.5">
        <p className="eyebrow text-muted-foreground">Live receipt</p>
        {amounts && <StatusBadge status={amounts.paymentStatus} />}
      </header>

      {amounts ? (
        <>
          <dl className="space-y-2.5 px-5 py-4 text-sm" aria-live="polite">
            <Row label="Gross" detail={`${travellers} × ₹${formatAmount(ratePerPerson)}`}>
              <Money amount={amounts.grossAmount} />
            </Row>
            <Row label="Discount" detail={`(${amounts.discountPercentage}%)`}>
              <Money amount={-preview.discountAmount || 0} />
            </Row>
            <div className="rule-double !my-3" aria-hidden />
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-medium">Total amount</dt>
              <dd className="font-heading text-2xl font-medium">
                <Money amount={amounts.totalAmount} />
              </dd>
            </div>
            <Row label="Received">
              <Money amount={Number.isFinite(preview.amountPaid) ? preview.amountPaid : 0} />
            </Row>
            <Row label="Balance" strong>
              <Money amount={amounts.balanceAmount} />
            </Row>
          </dl>
          <div className="border-t bg-muted/40 px-5 py-3.5">
            <p className="eyebrow text-muted-foreground">Total amount (in words)</p>
            <p className="mt-1 font-heading text-[0.9375rem] italic">{amountToWords(amounts.totalAmount)}</p>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-3 px-5 py-6 text-sm text-muted-foreground">
          <Calculator className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p aria-live="polite">{problem}</p>
        </div>
      )}
    </section>
  );
}
