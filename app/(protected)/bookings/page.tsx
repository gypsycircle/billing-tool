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
import { PageHeader } from "@/components/shared/page-header";
import { RecordList } from "@/components/shared/record-list";
import { Stat, StatGroup } from "@/components/shared/stat";
import { tripDatePresets } from "@/lib/domain/date-range";
import { todayIST } from "@/lib/domain/dates";
import { bookingFilterParams, hasActiveFilters, parseBookingFilters } from "@/lib/domain/filters";
import { routes } from "@/lib/domain/routes";
import { SHORTCUTS } from "@/lib/domain/shortcuts";
import { plural } from "@/lib/domain/words";
import { getBookingLedger } from "@/lib/server/bookings/service";
import { getTeamFilterOptions } from "@/lib/server/team/service";

export const metadata: Metadata = { title: "Bookings" };


export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const filters = parseBookingFilters(await searchParams);
  // One page of the ledger, its totals, the summary figures and the destination
  // list, all from the database in parallel
  const [ledger, team] = await Promise.all([getBookingLedger(filters), getTeamFilterOptions()]);
  const { summary } = ledger;
  const today = todayIST();
  // The archived view with nothing else narrowing it
  const onlyArchivedView = filters.archived && !hasActiveFilters({ ...filters, archived: false });

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Bookings"
        description="Every active booking, what has been received and what is still owed."
        actions={<NewRecordButton href={routes.bookings.new} label="New booking" shortcut={SHORTCUTS.newBooking} />}
      />

      <StatGroup className="mb-10">
        <Stat
          label="Outstanding"
          value={<Money amount={summary.outstanding} />}
          hint={summary.overdueCount > 0 ? `${plural(summary.overdueCount, "booking")} overdue` : "Nothing overdue"}
        />
        <Stat
          label="Collected"
          value={<Money amount={summary.collected} />}
          hint={
            summary.refundsDueCount > 0 ? (
              <>
                After refunds · <Money amount={summary.refundsDueAmount} /> to refund on {plural(summary.refundsDueCount, "booking")}
              </>
            ) : (
              "After refunds on cancelled bookings"
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
              title="The ledger is empty"
              description="Bookings you create appear here with their payments and balances, ready to issue a Bill of Supply."
              newHref={routes.bookings.new}
              newLabel="Create the first booking"
            />
          )
        }
        filters={<BookingFilters destinations={ledger.destinations} tripDatePresets={tripDatePresets(today)} today={today} team={team} />}
        table={<LedgerTable bookings={ledger.items} totals={ledger.totals} archived={filters.archived} />}
        noMatches={<NoMatches plural="bookings" listHref={routes.bookings.list} archivedOnly={onlyArchivedView} filtered={hasActiveFilters(filters)} />}
        page={ledger}
        links={{ path: routes.bookings.list, params: bookingFilterParams(filters) }}
      />
    </>
  );
}
