// components/shared/filter-toolbar.tsx
// The pieces of a list's filters: a debounced search box; the labelled fields a
// FilterDialog holds: selects, a date range, archived only.
// Values live in the URL (useUrlFilters) and are applied on the server.

"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { presetOf, type DatePreset } from "@/lib/domain/date-range";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { DateRangePicker, rangeTriggerLabel } from "./date-range-picker";
import { FilterDialogElement } from "./filter-dialog";
import { OptionSelect } from "./option-select";
import { cn } from "@/lib/utils";

const ALL = "all";

/** A filter's visible name over its control (the control carries the same name for screen readers). */
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground" aria-hidden>
        {label}
      </p>
      {children}
    </div>
  );
}

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

type FilterOptions = readonly string[] | Readonly<Record<string, string>>;

/** The dropdown alone. `options`: values shown as is, or { value: label }. "" means all; with no `allLabel` one option is always chosen. */
function FilterDropdown({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel?: string;
  options: FilterOptions;
  value: string;
  onChange: (value: string) => void;
}) {
  const labels: Record<string, string> = Array.isArray(options)
    ? Object.fromEntries(options.map((o) => [o, o]))
    : { ...(options as Readonly<Record<string, string>>) };
  return (
    <OptionSelect
      label={label}
      options={allLabel ? { [ALL]: allLabel, ...labels } : labels}
      value={value || (allLabel ? ALL : "")}
      onChange={(next) => onChange(next === ALL ? "" : next)}
      className={cn("w-full min-w-0 flex-1", value && "border-brand/50 text-foreground")}
    />
  );
}

/** One filter: its label over its dropdown. */
export function FilterSelect(props: React.ComponentProps<typeof FilterDropdown>) {
  return (
    <FilterField label={props.label}>
      <FilterDropdown {...props} />
    </FilterField>
  );
}

const CUSTOM = "custom";

/**
 * A date-range filter (?from=&to=, YYYY-MM-DD), like the dashboard's period:
 * a dropdown of quick picks ending in "Custom range". Choosing that opens the
 * calendar (DateRangePicker) over the modal, and an icon beside the dropdown
 * opens it again, so the field never changes height. A range that is exactly a
 * quick pick shows as that pick; any other shows its dates. The first option clears it.
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
  const modal = use(FilterDialogElement);

  return (
    <FilterField label={label}>
      <div className="flex gap-2">
        <FilterDropdown
          label={label}
          allLabel={allLabel}
          options={{ ...Object.fromEntries(presets.map((p) => [p.id, p.label])), [CUSTOM]: set && !picked ? rangeTriggerLabel(range.from, range.to) : "Custom range" }}
          value={custom ? CUSTOM : (picked?.id ?? "")}
          onChange={(next) => {
            if (next === CUSTOM) return setCustomChosen(true);
            setCustomChosen(false);
            const preset = presets.find((p) => p.id === next);
            onChange(preset ? toISODate(preset.from) : "", preset ? toISODate(preset.to) : "");
          }}
        />
        {custom && (
          <DateRangePicker
            iconOnly
            defaultOpen={customChosen}
            centerOn={modal}
            label={label}
            placeholder="Pick the dates"
            from={range.from}
            to={range.to}
            latest={latest}
            onChange={onChange}
            className="w-9 shrink-0 px-0"
          />
        )}
      </div>
    </FilterField>
  );
}

/** The modal's last row: the archived view on or off. */
export function FilterArchived({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="col-span-full flex cursor-pointer items-center gap-2 border-t pt-3 text-sm">
      <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      {label}
    </label>
  );
}
