// components/shared/date-range-picker.tsx
// A date range (shadcn's Date Picker, range: a Popover around the Calendar):
// the bookings and expenses filters, the dashboard's custom period and its
// two comparison ranges, each shown for "Custom range" beside its dropdown
// of quick picks. Click the first day, then the last (either order; the same
// day twice is one day): the range applies and the calendar closes. Two
// months from md, one on phones. Values are DD/MM/YYYY in, YYYY-MM-DD out
// (they go into the URL).

"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDisplayDate, fromLocalDay, rangeLabel, toISODate, toLocalDay } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import { outsideLimits } from "./date-picker";

/** What the trigger says: "1 Oct – 29 Oct 2026", "From 1 Oct 2026", "Until 29 Oct 2026". */
function triggerLabel(from: string, to: string): string {
  if (from && to) return rangeLabel(from, to);
  if (from) return `From ${formatDisplayDate(from)}`;
  return `Until ${formatDisplayDate(to)}`;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  label,
  placeholder = "Any date",
  earliest,
  latest,
  className,
}: {
  /** The range shown (DD/MM/YYYY; "" for an open end). */
  from: string;
  to: string;
  /** The picked range, YYYY-MM-DD. */
  onChange: (from: string, to: string) => void;
  /** What the range is for, for screen readers ("Trip date", "Range A"). */
  label: string;
  /** The trigger's text with no range. */
  placeholder?: string;
  /** The first and last days that can be picked (DD/MM/YYYY). */
  earliest?: string;
  latest?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // The first day clicked, while the last is being picked
  const [start, setStart] = useState<Date | undefined>();
  const set = !!(from || to);

  const apply = (first: string, last: string) => {
    setOpen(false);
    if (first !== from || last !== to) onChange(toISODate(first), toISODate(last));
  };

  const pick = (day: Date) => {
    if (!start) return setStart(day);
    const [first, last] = day < start ? [day, start] : [start, day];
    setStart(undefined);
    apply(fromLocalDay(first), fromLocalDay(last));
  };

  const selected = start ? { from: start, to: undefined } : { from: toLocalDay(from), to: toLocalDay(to) };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setStart(undefined);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            aria-label={`${label}: ${set ? triggerLabel(from, to) : placeholder}`}
            className={cn("text-sm justify-start bg-card font-normal tabular", set ? "border-brand/50 text-foreground" : "text-muted-foreground", className)}
          />
        }
      >
        <CalendarRange aria-hidden />
        <span className="truncate">{set ? triggerLabel(from, to) : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(_range, day) => pick(day)}
          defaultMonth={toLocalDay(from) ?? toLocalDay(latest ?? "")}
          numberOfMonths={2}
          disabled={outsideLimits(earliest, latest)}
          // One month on phones: the second is hidden below md
          className="max-md:[&_.rdp-month+.rdp-month]:hidden"
        />
        {start && (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
            Now pick the last day.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
