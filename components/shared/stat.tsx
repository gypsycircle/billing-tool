// components/shared/stat.tsx
// Summary figures, set like the totals block of a ledger page.
//   <StatGroup>
//     <Stat label="Outstanding" value={<Money amount={…} />} change={…} hint="…" />
//   </StatGroup>

import { cn } from "@/lib/utils";
import { STAT_COLUMNS, STAT_FIGURE, STAT_GRID } from "./layout-classes";

export function StatGroup({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: keyof typeof STAT_COLUMNS;
  className?: string;
}) {
  return (
    <dl className={cn(STAT_GRID, STAT_COLUMNS[columns], className)}>
      {children}
    </dl>
  );
}

export function Stat({
  label,
  value,
  change,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  /** How the value moved, shown beside it (the dashboard's ChangeBadge). */
  change?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-card px-5 py-5">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={STAT_FIGURE}>{value}</span>
        {change}
      </dd>
      {hint && <dd className="space-y-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
