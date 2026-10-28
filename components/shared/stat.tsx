// components/shared/stat.tsx
// Summary figures, set like the totals block of a ledger page.
//   <StatGroup>
//     <Stat label="Outstanding" value={<Money amount={…} />} hint="…" />
//   </StatGroup>

import { cn } from "@/lib/utils";

/** Joined cells separated by hairlines (gap-px over the border colour). */
export function StatGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4",
        className
      )}
    >
      {children}
    </dl>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-card px-5 py-5">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl leading-none font-medium tabular sm:text-[1.75rem]">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
