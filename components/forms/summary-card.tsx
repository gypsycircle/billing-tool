// components/forms/summary-card.tsx
// The card beside a form that shows the record as it will be saved, updated
// as the user types (the booking's live receipt, the expense's summary):
// a header with a badge, rows, the big total, and the amount in words; or a
// hint until there is enough to show. Preview only: the server works out the
// real values on save.

import type { LucideIcon } from "lucide-react";
import { CARD } from "@/components/shared/layout-classes";
import { AmountInWords, FigureRow } from "@/components/shared/record-document";
import { Money } from "@/components/shared/money";
import { cn } from "@/lib/utils";

export function SummaryCard({
  label,
  badge,
  words,
  empty,
  children,
}: {
  label: string;
  badge?: React.ReactNode;
  /** The amount in words at the foot; null until there is enough to show (then `empty` shows). */
  words: { label: string; amount: number } | null;
  /** What's missing, with an icon. */
  empty: { icon: LucideIcon; message: React.ReactNode };
  /** The rows (SummaryRow, SummaryTotal). */
  children: React.ReactNode;
}) {
  const Icon = empty.icon;
  return (
    <section aria-label={label} className={cn(CARD, "overflow-hidden")}>
      <header className="flex items-center justify-between border-b px-5 py-3.5">
        <p className="eyebrow text-muted-foreground">{label}</p>
        {badge}
      </header>

      {words ? (
        <>
          <dl className="space-y-2.5 px-5 py-4 text-sm" aria-live="polite">
            {children}
          </dl>
          <AmountInWords amount={words.amount} label={words.label} className="border-t bg-muted/40 px-5 py-3.5" textClassName="text-[0.9375rem]" />
        </>
      ) : (
        <div className="flex items-start gap-3 px-5 py-6 text-sm text-muted-foreground">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p aria-live="polite">{empty.message}</p>
        </div>
      )}
    </section>
  );
}

/** One line of a summary: label (with an optional detail) and value. */
export function SummaryRow({
  label,
  detail,
  strong,
  valueClassName,
  children,
}: {
  label: string;
  detail?: string;
  strong?: boolean;
  valueClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <FigureRow
      label={
        <>
          {label}
          {detail && <span className="ml-1.5 text-xs text-muted-foreground tabular">{detail}</span>}
        </>
      }
      labelClassName={strong ? "font-medium" : "text-muted-foreground"}
      valueClassName={cn(strong && "font-semibold", valueClassName)}
    >
      {children}
    </FigureRow>
  );
}

/** The big total under a double rule. */
export function SummaryTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <>
      <div className="rule-double !my-3" aria-hidden />
      <FigureRow label={label} labelClassName="font-medium" valueClassName="font-heading text-2xl font-medium">
        <Money amount={amount} />
      </FigureRow>
    </>
  );
}
