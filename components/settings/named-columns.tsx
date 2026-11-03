// components/settings/named-columns.tsx
// The columns of a Settings list (team members, list items): the name, the
// record's own columns, its status, and its "⋯" menu.

import { actionsColumn, type LedgerColumn } from "@/components/shared/ledger-table-frame";
import { StatusBadge } from "@/components/shared/status-badge";
import type { NamedRecord } from "@/lib/domain/named-records";

export function namedColumns<Rec extends NamedRecord>(
  menu: (record: Rec) => React.ReactNode,
  { between = [], statusClassName }: { between?: LedgerColumn<Rec>[]; statusClassName?: string } = {}
): LedgerColumn<Rec>[] {
  return [
    { header: "Name", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    ...between,
    { header: "Status", className: statusClassName, cell: (r) => <StatusBadge value={r.status} /> },
    actionsColumn(menu),
  ];
}
