// components/bookings/booking-filters.tsx
// The ledger's search and filters, built from the shared toolbar pieces.

"use client";

import { useCallback } from "react";
import { FilterDialog } from "@/components/shared/filter-dialog";
import { FilterArchived, FilterDateRange, FilterSearch, FilterSelect } from "@/components/shared/filter-toolbar";
import type { DatePreset } from "@/lib/domain/date-range";
import { paymentFilterOptions, TRIP_STATUSES, type TripStatus } from "@/lib/domain/filters";
import { DUE_SOON_DAYS } from "@/lib/domain/summary";
import { showArchivedLabel } from "@/lib/domain/records";
import { useFilterDraft } from "@/hooks/use-filter-draft";
import { useUrlFilters } from "@/hooks/use-url-filters";

const DIALOG_KEYS = ["package", "payment", "status", "archived", "due", "tripFrom", "tripTo", "bookedFrom", "bookedTo", "closedBy"] as const;
const FILTER_KEYS = ["q", ...DIALOG_KEYS] as const;

/** Same rule as the "Due in 7 days" figure and the overdue count (active bookings with a balance). */
const DUE_OPTIONS = { overdue: "Overdue", week: `Due in ${DUE_SOON_DAYS} days` } as const;

/**
 * `applied`: how many filters the server applied. `tripDatePresets` and
 * `bookedDatePresets`: each date filter's quick picks, and `today`: the last day
 * a booking can have been made (all worked out on the server, in India). `team`:
 * who can have closed a booking (value → label).
 */
export function BookingFilters({
  applied,
  packages,
  tripDatePresets,
  bookedDatePresets,
  today,
  team,
}: {
  applied: number;
  /** The Settings list (name → label). */
  packages: Readonly<Record<string, string>>;
  tripDatePresets: readonly DatePreset[];
  bookedDatePresets: readonly DatePreset[];
  today: string;
  team: Readonly<Record<string, string>>;
}) {
  const url = useUrlFilters(FILTER_KEYS);
  const { get, set, discard, apply, reset } = useFilterDraft(url, DIALOG_KEYS);
  const setUrl = url.set;
  const onSearch = useCallback((q: string) => setUrl({ q }), [setUrl]);
  const archived = get("archived") === "1";
  // Only an active booking can be archived, so that view has no trip status
  const cancelled = !archived && get("status") === "Cancelled";
  /** A payment choice the new view doesn't offer is cleared. */
  const paymentFor = (status: TripStatus) => (paymentFilterOptions(status).some((option) => option === get("payment")) ? {} : { payment: "" });
  // Only an active booking has anything due
  const onTripStatus = (status: string) => (status === "Cancelled" ? set({ status, due: "", ...paymentFor("Cancelled") }) : set({ status: "", ...paymentFor("Active") }));

  return (
    <FilterDialog
      count={applied}
      pending={url.isPending}
      onApply={apply}
      onReset={reset}
      onDiscard={discard}
      search={
        <FilterSearch
          value={url.get("q")}
          onSearch={onSearch}
          pending={url.isPending}
          placeholder="Search name, mobile, invoice no, package"
          label="Search bookings"
        />
      }
    >
      {Object.keys(packages).length > 0 && (
        <FilterSelect label="Package" allLabel="All packages" options={packages} value={get("package")} onChange={(name) => set({ package: name })} />
      )}
      {Object.keys(team).length > 0 && (
        <FilterSelect label="Lead closed by" allLabel="Anyone" options={team} value={get("closedBy")} onChange={(closedBy) => set({ closedBy })} />
      )}
      {/* Its own dropdown per list of choices: a kept one can go on showing a choice from the old list */}
      <FilterSelect
        key={cancelled ? "refund" : "payment"}
        label={cancelled ? "Refund status" : "Payment status"}
        allLabel={cancelled ? "Any refund status" : "Any status"}
        options={paymentFilterOptions(cancelled ? "Cancelled" : "Active")}
        value={get("payment")}
        onChange={(payment) => set({ payment })}
      />
      {!archived && <FilterSelect label="Trip status" options={TRIP_STATUSES} value={cancelled ? "Cancelled" : "Active"} onChange={onTripStatus} />}
      {!cancelled && <FilterSelect label="Due date" allLabel="Any due date" options={DUE_OPTIONS} value={get("due")} onChange={(due) => set({ due })} />}
      <FilterDateRange
        label="Trip date"
        allLabel="Any trip date"
        from={get("tripFrom")}
        to={get("tripTo")}
        presets={tripDatePresets}
        onChange={(tripFrom, tripTo) => set({ tripFrom, tripTo })}
      />
      <FilterDateRange
        label="Booked date"
        allLabel="Any date"
        from={get("bookedFrom")}
        to={get("bookedTo")}
        presets={bookedDatePresets}
        latest={today}
        onChange={(bookedFrom, bookedTo) => set({ bookedFrom, bookedTo })}
      />
      <FilterArchived label={showArchivedLabel("bookings")} checked={archived} onChange={(on) => set(on ? { archived: "1", status: "", ...paymentFor("Active") } : { archived: "" })} />
    </FilterDialog>
  );
}
