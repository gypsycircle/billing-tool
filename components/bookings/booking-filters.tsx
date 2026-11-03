// components/bookings/booking-filters.tsx
// The ledger's search and filters, built from the shared toolbar pieces.

"use client";

import { useCallback } from "react";
import { FilterDate, FilterDateRange, FilterSearch, FilterSelect, FilterToolbar } from "@/components/shared/filter-toolbar";
import type { DatePreset } from "@/lib/domain/date-range";
import { REFUND_STATUSES } from "@/lib/domain/refunds";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "@/lib/domain/types";
import { DUE_SOON_DAYS } from "@/lib/domain/summary";
import { useUrlFilters } from "@/hooks/use-url-filters";

const FILTER_KEYS = ["q", "destination", "payment", "status", "archived", "due", "from", "to", "booked", "closedBy"] as const;

/** Same rule as the "Due in 7 days" figure and the overdue count (active bookings with a balance). */
const DUE_OPTIONS = { overdue: "Overdue", week: `Due in ${DUE_SOON_DAYS} days` } as const;

/**
 * `tripDatePresets`: the trip-date filter's quick picks, and `today`: the last
 * day a booking can have been made (both worked out on the server, in India).
 * `team`: who can have closed a booking (value → label).
 */
export function BookingFilters({
  destinations,
  tripDatePresets,
  today,
  team,
}: {
  /** The Settings list (name → label). */
  destinations: Readonly<Record<string, string>>;
  tripDatePresets: readonly DatePreset[];
  today: string;
  team: Readonly<Record<string, string>>;
}) {
  const { get, set, clear, hasAny, isPending, archived } = useUrlFilters(FILTER_KEYS);
  const onSearch = useCallback((q: string) => set({ q }), [set]);

  return (
    <FilterToolbar
      archived={archived}
      // The archived view has no trip status or due date to keep
      onToggleArchived={() => set({ archived: archived ? "" : "1", status: "", due: "" })}
      onReset={hasAny ? clear : undefined}
      search={
        <FilterSearch
          value={get("q")}
          onSearch={onSearch}
          pending={isPending}
          placeholder="Search name, mobile, invoice no., package…"
          label="Search bookings"
        />
      }
    >
      {Object.keys(destinations).length > 0 && (
        <FilterSelect
          label="Destination"
          allLabel="All destinations"
          options={destinations}
          value={get("destination")}
          onChange={(destination) => set({ destination })}
        />
      )}
      <FilterSelect
        label="Payment status"
        allLabel="Any payment status"
        options={[...PAYMENT_STATUSES, ...REFUND_STATUSES]}
        value={get("payment")}
        onChange={(payment) => set({ payment })}
      />
      {/* The archived view holds archived bookings only, none of them due */}
      {!archived && (
        <>
          <FilterSelect
            label="Trip status"
            allLabel="Any trip status"
            options={BOOKING_STATUSES.filter((s) => s !== "Archived")}
            value={get("status")}
            onChange={(status) => set({ status })}
          />
          <FilterSelect
            label="Due date"
            allLabel="Any due date"
            options={DUE_OPTIONS}
            value={get("due")}
            onChange={(due) => set({ due })}
          />
        </>
      )}
      <FilterDateRange
        label="Trip date"
        allLabel="Any trip date"
        from={get("from")}
        to={get("to")}
        presets={tripDatePresets}
        onChange={(from, to) => set({ from, to })}
      />
      {Object.keys(team).length > 0 && (
        <FilterSelect label="Closed by" allLabel="Closed by anyone" options={team} value={get("closedBy")} onChange={(closedBy) => set({ closedBy })} />
      )}
      <FilterDate label="Booked date" placeholder="Any booked date" value={get("booked")} max={today} onChange={(booked) => set({ booked })} />
    </FilterToolbar>
  );
}
