// components/shared/stat.tsx
// Summary figures, set like the totals block of a ledger page.
//   <StatGroup>
//     <Stat label="Outstanding" value={<Money amount={…} />} change={…} hint="…" note="…" />
//   </StatGroup>

import { cn } from "@/lib/utils";
import { STAT_COLUMNS, STAT_FIGURE, STAT_GRID } from "./layout-classes";
import { TileNote } from "./tile-note";

export function StatGroup({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: keyof typeof STAT_COLUMNS;
}) {
  return (
    <dl className={cn(STAT_GRID, STAT_COLUMNS[columns])}>
      {children}
    </dl>
  );
}

export function Stat({
  label,
  value,
  change,
  hint,
  note,
}: {
  label: string;
  value: React.ReactNode;
  /** How the value moved, shown beside it (the dashboard's ChangeBadge). */
  change?: React.ReactNode;
  hint?: React.ReactNode;
  /** Something to act on (a refund due, bookings overdue), behind a note icon. Leave out when there's nothing. */
  note?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-card px-5 py-5">
      <dt className="eyebrow flex items-center justify-between gap-2 text-muted-foreground">
        {label}
        {note && <TileNote>{note}</TileNote>}
      </dt>
      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={STAT_FIGURE}>{value}</span>
        {change}
      </dd>
      {hint && <dd className="space-y-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
