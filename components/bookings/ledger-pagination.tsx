// components/bookings/ledger-pagination.tsx
// Page links under the ledger. Plain links (no client JavaScript) that keep
// the current filters; hidden when everything fits on one page.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingFilters, PageInfo } from "@/lib/domain/filters";
import { cn } from "@/lib/utils";

/** The ledger URL for a page, with the filters that are set. */
function pageHref(filters: BookingFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.destination) params.set("destination", filters.destination);
  if (filters.payment) params.set("payment", filters.payment);
  if (filters.status) params.set("status", filters.status);
  if (filters.archived) params.set("archived", "1");
  if (filters.due) params.set("due", filters.due);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/bookings${query ? `?${query}` : ""}#ledger`; // land on the top of the table
}

/** 1 … 4 5 6 … 12: the first and last page, and the pages next to the current one. */
function pageNumbers(page: number, pageCount: number): (number | "gap")[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  for (const p of shown) {
    const previous = result.at(-1);
    if (typeof previous === "number" && p - previous === 2) result.push(p - 1); // a gap of one page: show it
    else if (typeof previous === "number" && p - previous > 2) result.push("gap");
    result.push(p);
  }
  return result;
}

function StepLink({ filters, page, disabled, direction }: { filters: BookingFilters; page: number; disabled: boolean; direction: "previous" | "next" }) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  const label = direction === "previous" ? "Previous page" : "Next page";
  if (disabled) {
    return (
      <Button variant="outline" size="icon-lg" className="bg-card" disabled aria-label={label}>
        <Icon />
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="icon-lg"
      className="bg-card"
      aria-label={label}
      nativeButton={false}
      render={<Link href={pageHref(filters, page)} />}
    >
      <Icon />
    </Button>
  );
}

export function LedgerPagination({ filters, page }: { filters: BookingFilters; page: PageInfo }) {
  if (page.pageCount <= 1) return null;

  return (
    <nav aria-label="Ledger pages" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground tabular">
        Showing {page.from}–{page.to} of {page.total}
      </p>

      <div className="flex items-center gap-1.5">
        <StepLink filters={filters} page={page.page - 1} disabled={page.page === 1} direction="previous" />

        {/* Mobile: compact position */}
        <span className="px-2 text-sm tabular sm:hidden">
          {page.page} / {page.pageCount}
        </span>

        {/* Larger screens: page numbers */}
        <ol className="hidden items-center gap-1.5 sm:flex">
          {pageNumbers(page.page, page.pageCount).map((p, i) =>
            p === "gap" ? (
              <li key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
                …
              </li>
            ) : (
              <li key={p}>
                <Button
                  variant={p === page.page ? "default" : "ghost"}
                  size="icon-lg"
                  className={cn("tabular", p !== page.page && "text-muted-foreground")}
                  aria-label={`Page ${p}`}
                  aria-current={p === page.page ? "page" : undefined}
                  nativeButton={false}
                  render={<Link href={pageHref(filters, p)} />}
                >
                  {p}
                </Button>
              </li>
            )
          )}
        </ol>

        <StepLink filters={filters} page={page.page + 1} disabled={page.page === page.pageCount} direction="next" />
      </div>
    </nav>
  );
}
