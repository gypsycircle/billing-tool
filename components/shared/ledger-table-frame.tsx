// components/shared/ledger-table-frame.tsx
// The frame of every list (bookings, expenses, Settings' team and lists): a
// table on desktop, with an optional totals footer under a double rule like
// the foot of a ledger page, and stacked cards on small screens. Lists give
// only their columns, footer cells and card content; the frame sets the
// header height and the padding at both edges, so every table lines up alike.

import Link from "next/link";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CARD, CARD_STACK } from "./layout-classes";

export interface LedgerColumn<Row> {
  /** Header text (an eyebrow label), or e.g. a screen-reader-only label. */
  header: React.ReactNode;
  headerClassName?: string;
  className?: string;
  cell: (row: Row) => React.ReactNode;
}

/** The last column of every list: the row's "⋯" menu. */
export function actionsColumn<Row>(cell: (row: Row) => React.ReactNode): LedgerColumn<Row> {
  return { header: <span className="sr-only">Actions</span>, headerClassName: "w-12", className: "text-right", cell };
}

/** The first column of a record's list: its number. */
export function numberColumn<Row>(cell: (row: Row) => React.ReactNode): LedgerColumn<Row> {
  return { header: "No.", headerClassName: "w-36", className: "font-heading text-sm tabular", cell };
}

/** A right-aligned column of figures; `strong` for the one that matters most (the balance). */
export function amountColumn<Row>(header: string, cell: (row: Row) => React.ReactNode, { strong, className }: { strong?: boolean; className?: string } = {}): LedgerColumn<Row> {
  return { header, headerClassName: "text-right", className: cn("text-right", strong && "font-medium", className), cell };
}

/** The same edge padding for every table: the first column's left, the last column's right. */
const edge = (i: number, count: number) => cn(i === 0 && "pl-5", i === count - 1 && "pr-3");

/**
 * The table itself: a bordered card, an eyebrow header row, and the shared
 * edge padding. Lists use it through LedgerTableFrame; the dashboard's
 * "Show as a table" views use it directly (it scrolls sideways when narrow).
 */
export function LedgerTable<Row>({
  rows,
  rowKey,
  columns,
  muted,
  footer,
  caption,
  className,
}: {
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  columns: readonly LedgerColumn<Row>[];
  /** Rows shown dimmed (e.g. not active). */
  muted?: (row: Row) => boolean;
  /** The totals row's cells (TableCell elements). */
  footer?: React.ReactNode;
  /** What the table shows, for screen readers. */
  caption?: string;
  className?: string;
}) {
  return (
    <div className={cn(CARD, "overflow-hidden", className)}>
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {columns.map((column, i) => (
              <TableHead key={i} className={cn("eyebrow h-10 text-muted-foreground", edge(i, columns.length), column.headerClassName)}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)} className={cn("group", muted?.(row) && "text-muted-foreground")}>
              {columns.map((column, i) => (
                <TableCell key={i} className={cn(edge(i, columns.length), column.className)}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {footer && (
          <TableFooter className="border-t-0 bg-transparent">
            <TableRow className="border-t-[3px] border-double border-t-rule hover:bg-transparent">{footer}</TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

/** A list: the table on desktop, a card per row on small screens. */
export function LedgerTableFrame<Row>({
  rows,
  rowKey,
  columns,
  muted,
  footer,
  card,
}: {
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  columns: readonly LedgerColumn<Row>[];
  /** Rows shown dimmed (e.g. not active). */
  muted?: (row: Row) => boolean;
  /** The totals row's cells (TableCell elements). */
  footer?: React.ReactNode;
  /** A row as a card on small screens. */
  card: (row: Row) => React.ReactNode;
}) {
  return (
    <>
      <LedgerTable rows={rows} rowKey={rowKey} columns={columns} muted={muted} footer={footer} className="hidden md:block" />

      {/* Mobile */}
      <ul className={cn(CARD_STACK, "md:hidden")}>
        {rows.map((row) => (
          <li key={rowKey(row)} className={cn(CARD, CARD_STACK, "p-4", muted?.(row) && "opacity-75")}>
            {card(row)}
          </li>
        ))}
      </ul>
    </>
  );
}

/** The first cell of a totals row: "TOTALS 3 matching". */
export function TotalsLabelCell({ colSpan, label = "Totals", children }: { colSpan: number; /** A row that isn't adding anything up says what it is instead ("Now"). */ label?: string; children?: React.ReactNode }) {
  return (
    <TableCell colSpan={colSpan} className="pl-5 text-muted-foreground">
      <span className="eyebrow">{label}</span>
      {children && <span className="ml-2 text-xs">{children}</span>}
    </TableCell>
  );
}

/** A figure in a totals row; `strong` for the one that matters most (the balance). */
export function TotalCell({ strong, children }: { strong?: boolean; children: React.ReactNode }) {
  return <TableCell className={cn("text-right", strong ? "font-semibold" : "font-medium")}>{children}</TableCell>;
}

/** A line of text under a card's title. */
export function CardLine({ children }: { children: React.ReactNode }) {
  return <p className="truncate text-sm text-muted-foreground">{children}</p>;
}

/**
 * The top of a row's card on small screens: its number (eyebrow), its title
 * (a link to its page, when it has one), more lines, and its "⋯" menu.
 */
export function CardHeader({
  eyebrow,
  title,
  href,
  lines,
  menu,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  href?: string;
  lines?: React.ReactNode;
  menu: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className="eyebrow text-muted-foreground">{eyebrow}</p>}
        <div>
          {href ? (
            <Link href={href} className="block truncate font-medium">
              {title}
            </Link>
          ) : (
            <p className="font-medium break-words">{title}</p>
          )}
          {lines}
        </div>
      </div>
      {menu}
    </div>
  );
}

/** 4: equal shares of a phone's narrow row, except that a very large amount widens its column rather than overlap the next. */
const FIGURE_COLUMNS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-[repeat(4,minmax(max-content,1fr))]" } as const;

/**
 * A card's figures in equal columns (e.g. Total · Received · Balance): one
 * row of up to three, or `columns` a row (the booking's service line on phones).
 */
export function CardFigures({
  items,
  columns = Math.min(Math.max(items.length, 1), 3) as 1 | 2 | 3,
  className,
}: {
  items: readonly { label: string; value: React.ReactNode; strong?: boolean }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-2 border-t pt-3 text-sm", FIGURE_COLUMNS[columns], className)}>
      {items.map(({ label, value, strong }) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className={cn(strong && "font-medium")}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A card's small labelled details (e.g. Pax · Payment · Trip). */
export function CardMeta({ items }: { items: readonly { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-1.5">
          <dt className="shrink-0 whitespace-nowrap">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
