// app/(protected)/page.tsx
// Dashboard: summary figures (active bookings), filters and the ledger.
// Filters and the page come from the URL and are applied here on the server.

import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { BookingFilters } from "@/components/bookings/booking-filters";
import { LedgerPagination } from "@/components/bookings/ledger-pagination";
import { LedgerTable } from "@/components/bookings/ledger-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { Stat, StatGroup } from "@/components/shared/stat";
import { hasActiveFilters, parseBookingFilters } from "@/lib/domain/filters";
import { getLedger } from "@/lib/server/bookings/service";

export const metadata: Metadata = { title: "Bookings" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function DashboardPage({ searchParams }: PageProps<"/bookings">) {
  const filters = parseBookingFilters(await searchParams);
  // One page of the ledger, its totals, the summary figures and the destination
  // list, all from the database in parallel
  const ledger = await getLedger(filters);
  const { summary } = ledger;
  const onlyArchivedView = filters.archived && !filters.q && !filters.destination && !filters.payment;

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Bookings"
        description="Every active booking, what has been received and what is still owed."
        actions={
          <Button size="lg" nativeButton={false} render={<Link href="/bookings/new" />}>
            <Plus />
            New booking
            <Kbd className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex">N</Kbd>
          </Button>
        }
      />

      <StatGroup className="mb-10">
        <Stat
          label="Outstanding"
          value={<Money amount={summary.outstanding} />}
          hint={summary.overdueCount > 0 ? `${plural(summary.overdueCount, "booking")} overdue` : "Nothing overdue"}
        />
        <Stat label="Collected" value={<Money amount={summary.collected} />} hint="Received on active bookings" />
        <Stat label="Active bookings" value={summary.activeCount} hint="Cancelled and archived excluded" />
        <Stat
          label="Due in 7 days"
          value={<Money amount={summary.dueSoonAmount} />}
          hint={plural(summary.dueSoonCount, "booking")}
        />
      </StatGroup>

      {ledger.empty ? (
        <EmptyState
          icon={NotebookPen}
          title="The ledger is empty"
          description="Bookings you create appear here with their payments and balances, ready to issue a Bill of Supply."
          action={
            <Button variant="outline" nativeButton={false} render={<Link href="/bookings/new" />}>
              <Plus />
              Create the first booking
            </Button>
          }
        />
      ) : (
        <div id="ledger" className="scroll-mt-24 space-y-4">
          <BookingFilters destinations={ledger.destinations} />
          {ledger.total > 0 ? (
            <>
              <LedgerTable bookings={ledger.items} totals={ledger.totals} archived={filters.archived} />
              <LedgerPagination filters={filters} page={ledger} />
            </>
          ) : (
            <EmptyState
              icon={SearchX}
              title={onlyArchivedView ? "No archived bookings" : "No bookings match"}
              description={
                onlyArchivedView
                  ? "Bookings you archive appear here, ready to restore."
                  : hasActiveFilters(filters)
                  ? "Try a different search, or reset the filters."
                  : "There are no bookings to show."
              }
              action={
                <Button variant="outline" nativeButton={false} render={<Link href="/bookings" />}>
                  Reset filters
                </Button>
              }
            />
          )}
        </div>
      )}
    </>
  );
}
