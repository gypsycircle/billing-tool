// components/bookings/booking-filters.tsx
// Search + filters for the ledger. Values live in the URL and are applied on
// the server; search is debounced so typing doesn't reload on every key.

"use client";

import { useEffect, useState } from "react";
import { Archive, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "@/lib/domain/types";
import { DUE_SOON_DAYS } from "@/lib/domain/summary";
import { useBookingFilters, type FilterKey } from "@/hooks/use-booking-filters";
import { cn } from "@/lib/utils";

const ALL = "all";

/** Same rule as the "Due in 7 days" figure and the overdue count (active bookings with a balance). */
const DUE_OPTIONS = { overdue: "Overdue", week: `Due in ${DUE_SOON_DAYS} days` } as const;

function FilterSelect({
  filterKey,
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  filterKey: FilterKey;
  label: string;
  allLabel: string;
  /** Values, shown as is, or { value: label }. */
  options: readonly string[] | Readonly<Record<string, string>>;
  value: string;
  onChange: (key: FilterKey, value: string) => void;
}) {
  const labels: Record<string, string> = Array.isArray(options)
    ? Object.fromEntries(options.map((o) => [o, o]))
    : { ...(options as Readonly<Record<string, string>>) };
  const items = { [ALL]: allLabel, ...labels };
  return (
    <Select
      items={items}
      value={value || ALL}
      onValueChange={(next) => onChange(filterKey, !next || next === ALL ? "" : String(next))}
    >
      <SelectTrigger
        size="lg"
        aria-label={label}
        className={cn("w-full min-w-40 flex-1 basis-40 bg-card", value && "border-brand/50 text-foreground")}
      >
        <SelectValue />
      </SelectTrigger>
      {/* Open below the trigger, not over it (Base UI's default lines the chosen item up with the trigger) */}
      <SelectContent alignItemWithTrigger={false} align="start">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {Object.entries(labels).map(([option, optionLabel]) => (
          <SelectItem key={option} value={option}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BookingFilters({ destinations }: { destinations: string[] }) {
  const { get, set, clear, hasAny, isPending } = useBookingFilters();
  const [query, setQuery] = useState(get("q"));

  // Debounce search → URL
  useEffect(() => {
    if (query.trim() === get("q")) return;
    const timer = setTimeout(() => set({ q: query.trim() }), 300);
    return () => clearTimeout(timer);
  }, [query, get, set]);

  const onSelect = (key: FilterKey, value: string) => set({ [key]: value });
  const archived = get("archived") === "1";

  return (
    <div className="space-y-3">
      <InputGroup className="h-9 bg-card">
        <InputGroupAddon>
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, mobile, invoice no., package…"
          aria-label="Search bookings"
          maxLength={100}
        />
        {query && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}>
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      <div className="flex flex-wrap items-center gap-2">
        {destinations.length > 0 && (
          <FilterSelect
            filterKey="destination"
            label="Destination"
            allLabel="All destinations"
            options={destinations}
            value={get("destination")}
            onChange={onSelect}
          />
        )}
        <FilterSelect
          filterKey="payment"
          label="Payment status"
          allLabel="Any payment status"
          options={PAYMENT_STATUSES}
          value={get("payment")}
          onChange={onSelect}
        />
        {/* The archived view holds archived bookings only, none of them due */}
        {!archived && (
          <>
            <FilterSelect
              filterKey="status"
              label="Trip status"
              allLabel="Any trip status"
              options={BOOKING_STATUSES.filter((s) => s !== "Archived")}
              value={get("status")}
              onChange={onSelect}
            />
            <FilterSelect
              filterKey="due"
              label="Due date"
              allLabel="Any due date"
              options={DUE_OPTIONS}
              value={get("due")}
              onChange={onSelect}
            />
          </>
        )}
        <Button
          variant="outline"
          size="lg"
          aria-pressed={archived}
          onClick={() => set({ archived: archived ? "" : "1", status: "", due: "" })}
          className={cn("bg-card", archived && "border-brand/50 bg-accent text-accent-foreground")}
        >
          <Archive />
          {archived ? "Archived only" : "Show archived"}
        </Button>
        {hasAny && (
          <Button
            variant="ghost"
            size="lg"
            className="text-muted-foreground"
            onClick={() => {
              setQuery("");
              clear();
            }}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
