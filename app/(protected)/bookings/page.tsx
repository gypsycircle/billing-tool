// app/(protected)/bookings/page.tsx
// The bookings ledger: summary figures (active bookings), filters and the table.
// Filters and the page come from the URL and are applied here on the server.

import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import { BookingFilters } from "@/components/bookings/booking-filters";
import { LedgerTable } from "@/components/bookings/ledger-table";
import { NoMatches, NothingYet } from "@/components/shared/list-empty-states";
import { Money } from "@/components/shared/money";
import { NewRecordButton } from "@/components/shared/new-record-button";
import { PageBody } from "@/components/shared/page-body";
import { PageHeader } from "@/components/shared/page-header";
import { RecordList } from "@/components/shared/record-list";
import { Stat, StatGroup } from "@/components/shared/stat";
import { pastDatePresets, tripDatePresets } from "@/lib/domain/date-range";
import { todayIST } from "@/lib/domain/dates";
import { bookingFilterCount, bookingFilterParams, hasActiveFilters, parseBookingFilters } from "@/lib/domain/filters";
import { routes } from "@/lib/domain/routes";
import { SHORTCUTS } from "@/lib/domain/shortcuts";
import { plural } from "@/lib/domain/words";
import { getBookingLedger } from "@/lib/server/bookings/service";
import { getGeneralFilterOptions } from "@/lib/server/general/service";
import { getSalesFilterOptions } from "@/lib/server/team/service";

export const metadata: Metadata = { title: "Bookings" };


export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const filters = parseBookingFilters(await searchParams);
  // One page of the ledger, its totals and the summary figures, plus the filters'
  // choices from Settings, all from the database in parallel
  const [ledger, packages, team] = await Promise.all([getBookingLedger(filters), getGeneralFilterOptions("package"), getSalesFilterOptions()]);
  const { summary } = ledger;
  const today = todayIST();
  // The archived view with nothing else narrowing it
  const onlyArchivedView = filters.archived && !hasActiveFilters({ ...filters, archived: false });

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Bookings"
        description="Every booking, what has been received and what is still owed."
        actions={<NewRecordButton href={routes.bookings.new} label="New booking" shortcut={SHORTCUTS.newBooking} />}
      />

      <PageBody>
        <StatGroup>
          <Stat
            label="Outstanding"
            value={<Money amount={summary.outstanding} />}
            hint="Still owed on active bookings"
            note={summary.overdueCount > 0 && `${plural(summary.overdueCount, "booking")} overdue`}
          />
          <Stat
            label="Collected"
            value={<Money amount={summary.collected} />}
            hint="After refunds on cancelled bookings"
            note={
              summary.refundsDueCount > 0 && (
                <>
                  <Money amount={summary.refundsDueAmount} /> to refund on {plural(summary.refundsDueCount, "booking")}
                </>
              )
            }
          />
          <Stat
            label="Active bookings"
            value={
              <>
                {summary.activeCount}{" "}
                <span className="text-base font-normal text-muted-foreground">({summary.activeTravellers} pax)</span>
              </>
            }
            hint="Cancelled and archived excluded"
          />
          <Stat
            label="Due in 7 days"
            value={<Money amount={summary.dueSoonAmount} />}
            hint={plural(summary.dueSoonCount, "booking")}
          />
        </StatGroup>

        <RecordList
          id="ledger"
          empty={
            ledger.empty && (
              <NothingYet
                icon={NotebookPen}
                title="No bookings yet"
                description="Bookings you create appear here with their payments and balances, ready to issue a Bill of Supply."
                newHref={routes.bookings.new}
                newLabel="Create the first booking"
              />
            )
          }
          filters={<BookingFilters applied={bookingFilterCount(filters)} packages={packages} tripDatePresets={tripDatePresets(today)} bookedDatePresets={pastDatePresets(today)} today={today} team={team} />}
          table={<LedgerTable bookings={ledger.items} totals={ledger.totals} archived={filters.archived} status={filters.status} payment={filters.payment} />}
          noMatches={<NoMatches plural="bookings" listHref={routes.bookings.list} archivedOnly={onlyArchivedView} filtered={hasActiveFilters(filters)} />}
          page={ledger}
          links={{ path: routes.bookings.list, params: bookingFilterParams(filters) }}
        />
      </PageBody>
    </>
  );
}
