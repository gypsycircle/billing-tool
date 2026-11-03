// components/shared/filter-toolbar.tsx
// The pieces of a list's filter toolbar (bookings, expenses, Settings): a debounced
// search box, filter selects, a date range, one day, the "Show archived" toggle and
// Reset. Values live in the URL (useUrlFilters) and are applied on the server.

"use client";

import { useEffect, useState } from "react";
import { Archive, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { presetOf, type DatePreset } from "@/lib/domain/date-range";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { DatePicker } from "./date-picker";
import { DateRangePicker } from "./date-range-picker";
import { OptionSelect } from "./option-select";
import { cn } from "@/lib/utils";

const ALL = "all";

/** Every filter control takes an equal share of its row. */
const FILTER_WIDTH = "w-full min-w-40 flex-1 basis-40";

/** Full-width search; sends the text after a pause, not on every key. */
export function FilterSearch({
  value,
  onSearch,
  pending,
  placeholder,
  label,
}: {
  /** The search in the URL. */
  value: string;
  onSearch: (query: string) => void;
  /** A filtered page is loading. */
  pending: boolean;
  placeholder: string;
  label: string;
}) {
  const [query, setQuery] = useState(value);

  // The search was cleared from outside (Reset): clear the box too. Other URL
  // changes are this box's own debounced updates, possibly behind the typing.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (!value) setQuery("");
  }

  useEffect(() => {
    if (query.trim() === value) return;
    const timer = setTimeout(() => onSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, value, onSearch]);

  return (
    <InputGroup className="h-9 bg-card">
      <InputGroupAddon>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}</InputGroupAddon>
      <InputGroupInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
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
  );
}

/** One filter. `options`: values shown as is, or { value: label }. "" means all. */
export function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: readonly string[] | Readonly<Record<string, string>>;
  value: string;
  onChange: (value: string) => void;
}) {
  const labels: Record<string, string> = Array.isArray(options)
    ? Object.fromEntries(options.map((o) => [o, o]))
    : { ...(options as Readonly<Record<string, string>>) };
  return (
    <OptionSelect
      label={label}
      options={{ [ALL]: allLabel, ...labels }}
      value={value || ALL}
      onChange={(next) => onChange(next === ALL ? "" : next)}
      className={cn(FILTER_WIDTH, value && "border-brand/50 text-foreground")}
    />
  );
}

const CUSTOM = "custom";

/**
 * A date-range filter (?from=&to=, YYYY-MM-DD), like the dashboard's period:
 * a dropdown of quick picks ending in "Custom range", which shows a calendar
 * (DateRangePicker) beside it. A range that is exactly a quick pick shows as
 * that pick; any other as Custom range. The first option clears it.
 */
export function FilterDateRange({
  label,
  allLabel,
  from,
  to,
  presets,
  latest,
  onChange,
}: {
  label: string;
  /** The first option, no range ("Any trip date"). */
  allLabel: string;
  /** The range in the URL (YYYY-MM-DD; "" for an open end). */
  from: string;
  to: string;
  presets: readonly DatePreset[];
  /** The last day the calendar offers (DD/MM/YYYY). */
  latest?: string;
  /** The new range, YYYY-MM-DD ("" and "" clears it). */
  onChange: (from: string, to: string) => void;
}) {
  const range = { from: fromISODate(from), to: fromISODate(to) };
  const set = !!(range.from || range.to);
  const picked = presetOf(presets, range);
  // "Custom range" chosen before any day is: shows the calendar with nothing picked yet
  const [customChosen, setCustomChosen] = useState(false);
  // The range changed: cleared (Reset) is back to the dropdown alone, and a
  // range that is exactly a quick pick shows as that pick
  const shown = `${range.from}~${range.to}`;
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    if (!set || picked) setCustomChosen(false);
  }
  const custom = customChosen || (set && !picked);

  return (
    <>
      {custom && (
        <DateRangePicker label={label} placeholder="Pick the dates" from={range.from} to={range.to} latest={latest} onChange={onChange} className={FILTER_WIDTH} />
      )}
      <FilterSelect
        label={label}
        allLabel={allLabel}
        options={{ ...Object.fromEntries(presets.map((p) => [p.id, p.label])), [CUSTOM]: "Custom range" }}
        value={custom ? CUSTOM : (picked?.id ?? "")}
        onChange={(next) => {
          if (next === CUSTOM) return setCustomChosen(true);
          setCustomChosen(false);
          const preset = presets.find((p) => p.id === next);
          onChange(preset ? toISODate(preset.from) : "", preset ? toISODate(preset.to) : "");
        }}
      />
    </>
  );
}

/**
 * A one-day filter (YYYY-MM-DD in the URL): the calendar itself, sized like the
 * filters beside it. While a day is set, its × clears this filter alone.
 */
export function FilterDate({
  label,
  placeholder,
  value,
  max,
  onChange,
}: {
  label: string;
  /** Shown with no day picked ("Any booked date"). */
  placeholder: string;
  /** The day in the URL (YYYY-MM-DD; "" for none). */
  value: string;
  /** The last day that can be picked (DD/MM/YYYY). */
  max?: string;
  /** The new day, YYYY-MM-DD ("" clears it). */
  onChange: (value: string) => void;
}) {
  const day = fromISODate(value);

  return (
    <div className={cn("relative", FILTER_WIDTH)}>
      <DatePicker
        label={label}
        placeholder={placeholder}
        value={day}
        max={max}
        onChange={(next) => onChange(toISODate(next))}
        className={cn("h-9 text-sm [&>span]:text-foreground", day && "border-brand/50 pr-9")}
      />
      {day && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
        >
          <X />
        </Button>
      )}
    </div>
  );
}

/** Switches the list to archived records only, and back. */
function ArchivedToggle({ archived, onToggle }: { archived: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="outline"
      size="lg"
      aria-pressed={archived}
      onClick={onToggle}
      className={cn("bg-card", archived && "border-brand/50 bg-accent text-accent-foreground")}
    >
      <Archive />
      {archived ? "Archived only" : "Show archived"}
    </Button>
  );
}

function ResetFilters({ onReset }: { onReset: () => void }) {
  return (
    <Button variant="ghost" size="lg" className="text-muted-foreground" onClick={onReset}>
      Reset
    </Button>
  );
}

/**
 * The toolbar: an optional full-width search, then the filters filling a row,
 * ending with the archived view's toggle and, while any filter is set, Reset.
 * With no filters, the search fills that row instead.
 */
export function FilterToolbar({
  search,
  archived,
  onToggleArchived,
  onReset,
  children,
}: {
  search?: React.ReactNode;
  /** The archived view is on. */
  archived: boolean;
  onToggleArchived: () => void;
  /** Clears every filter; shown only while one is set. */
  onReset?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {children && search}
      <div className="flex flex-wrap items-center gap-2">
        {children ?? (search && <div className="min-w-0 flex-1 basis-60">{search}</div>)}
        <ArchivedToggle archived={archived} onToggle={onToggleArchived} />
        {onReset && <ResetFilters onReset={onReset} />}
      </div>
    </div>
  );
}
