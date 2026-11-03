// components/shared/record-document.tsx
// A saved record on its page (a booking laid out like its bill, an expense):
// the card with its grey band of key facts and its body; plus what the pages
// and the forms' summaries share: label-over-content blocks, who it's for, label-and-amount rows, notes beside the figures, and the
// amount in words.

import { amountToWords } from "@/lib/domain/words";
import { cn } from "@/lib/utils";
import { CARD, RECORD_BAND } from "./layout-classes";
import { Money } from "./money";

export function RecordDocument({
  band,
  bandClassName,
  children,
}: {
  /** The band's facts (MetaItem). */
  band: React.ReactNode;
  /** Its columns: "sm:grid-cols-4". */
  bandClassName: string;
  children: React.ReactNode;
}) {
  return (
    <article className={cn(CARD, "overflow-hidden")}>
      <dl className={cn(RECORD_BAND, bandClassName)}>{band}</dl>
      {children}
    </article>
  );
}

/** A small label (eyebrow, with an optional icon) over its content, which sets its own spacing. */
export function LabeledBlock({ label, icon, className, children }: { label: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <p className={cn("eyebrow text-muted-foreground", icon && "flex items-center gap-1.5")}>
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}

/** Who it's for ("Bill to", "Paid for"): the label, the name large, and a line under it. */
export function PartyBlock({ label, name, className, children }: { label: string; name: string; className?: string; children: React.ReactNode }) {
  return (
    <LabeledBlock label={label} className={className}>
      <p className="mt-2 font-heading text-2xl font-medium break-words">{name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </LabeledBlock>
  );
}

/** One line of figures: a label on the left, its value on the right. Goes in a <dl>. */
export function FigureRow({ label, labelClassName, valueClassName, children }: { label: React.ReactNode; labelClassName?: string; valueClassName?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("shrink-0", labelClassName)}>{label}</dt>
      <dd className={valueClassName}>{children}</dd>
    </div>
  );
}

/** A record page's main amount. */
export function DocumentTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <FigureRow label={label} labelClassName="font-semibold" valueClassName="font-heading text-xl font-medium">
      <Money amount={amount} />
    </FigureRow>
  );
}

/** A record page's foot: its notes on the left; its figures and the amount in words on the right. */
export function NotesAndFigures({
  note,
  noNote,
  words,
  children,
}: {
  note: string;
  /** Shown when there is no note. */
  noNote: string;
  words: { amount: number; label?: string };
  /** The figures (DocumentTotal, FigureRow). */
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-8 px-6 pt-4 pb-6 sm:grid-cols-[minmax(0,1fr)_18rem]">
      <LabeledBlock label="Notes">
        <p className="mt-2 text-sm text-pretty whitespace-pre-line">{note || <span className="text-muted-foreground italic">{noNote}</span>}</p>
      </LabeledBlock>
      <div className="space-y-2 text-sm">
        <dl className="space-y-2">{children}</dl>
        <AmountInWords amount={words.amount} label={words.label} className="pt-3 text-right" />
      </div>
    </div>
  );
}

/** "AMOUNT (IN WORDS)" over the amount spelled out, in the heading face's italic; each place sets its size. */
export function AmountInWords({
  amount,
  label = "Amount (in words)",
  className,
  textClassName,
}: {
  amount: number;
  label?: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <LabeledBlock label={label} className={className}>
      <p className={cn("mt-1 font-heading italic", textClassName)}>{amountToWords(amount)}</p>
    </LabeledBlock>
  );
}
