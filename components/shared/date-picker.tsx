// components/shared/date-picker.tsx
// One date (shadcn's Date Picker: a Popover around the Calendar). The trigger
// shows the day ("7 Feb 2027"); month and year are dropdowns, so a day months
// away is a couple of taps; days outside `min` / `max` are disabled. Picking a
// day sets it and closes. Values are DD/MM/YYYY. Forms use it through
// DateField (components/forms/fields.tsx).

"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDisplayDate, fromLocalDay, toLocalDay } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

/** The years the month / year dropdowns offer: well back for old records, a few ahead for trips. */
const YEARS_BACK = 10;
const YEARS_AHEAD = 5;

/** The days a calendar can't pick, from DD/MM/YYYY limits. */
export function outsideLimits(min?: string, max?: string) {
  const before = min ? toLocalDay(min) : undefined;
  const after = max ? toLocalDay(max) : undefined;
  return [...(before ? [{ before }] : []), ...(after ? [{ after }] : [])];
}

export function DatePicker({
  id,
  value,
  onChange,
  onClose,
  min,
  max,
  placeholder = "Pick a date",
  label,
  invalid,
  describedBy,
  ref,
  className,
}: {
  id?: string;
  /** DD/MM/YYYY, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** The calendar closed (a form marks the field touched). */
  onClose?: () => void;
  /** The first and last days that can be picked (DD/MM/YYYY). */
  min?: string;
  max?: string;
  placeholder?: string;
  /** What the date is for, for screen readers, when no form label names it ("Booked date"). */
  label?: string;
  invalid?: boolean;
  describedBy?: string;
  /** The trigger, so a form can focus it (React Hook Form's field.ref). */
  ref?: React.Ref<HTMLButtonElement>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = toLocalDay(value);
  const thisYear = new Date().getFullYear();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose?.();
      }}
    >
      <PopoverTrigger
        ref={ref}
        render={
          <Button
            id={id}
            variant="outline"
            aria-label={label && `${label}: ${value ? formatDisplayDate(value) : placeholder}`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn("h-10 w-full justify-start bg-card px-3 font-normal tabular", className)}
          />
        }
      >
        <CalendarDays className="text-muted-foreground" aria-hidden />
        {value ? formatDisplayDate(value) : <span className="text-muted-foreground">{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? toLocalDay(min ?? "") ?? toLocalDay(max ?? "")}
          onSelect={(day) => {
            if (!day) return;
            onChange(fromLocalDay(day));
            setOpen(false);
            onClose?.();
          }}
          disabled={outsideLimits(min, max)}
          captionLayout="dropdown"
          startMonth={new Date(thisYear - YEARS_BACK, 0)}
          endMonth={new Date(thisYear + YEARS_AHEAD, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}
