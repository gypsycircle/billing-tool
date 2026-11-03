// components/shared/option-select.tsx
// The one dropdown every select in the app is built on (form fields, list
// filters, the dashboard's period and figure, the Settings list picker):
// options as { value: label }, opening below its trigger, on the card colour.
// An optional field gets `emptyLabel`, a first choice that clears it.

"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function OptionSelect({
  options,
  value,
  onChange,
  label,
  placeholder,
  emptyLabel,
  disabled,
  align = "start",
  className,
  trigger,
}: {
  options: Readonly<Record<string, string>>;
  /** The chosen value ("" for none). */
  value: string;
  /** The new value ("" when cleared). */
  onChange: (value: string) => void;
  /** Names it for screen readers when it has no visible label. */
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  /** Which edge the list lines up with. */
  align?: "start" | "end";
  className?: string;
  /** More props for the trigger (a form field's id, ref, blur and invalid state). */
  trigger?: Omit<React.ComponentProps<typeof SelectTrigger>, "className" | "children">;
}) {
  return (
    <Select items={options} value={value || null} onValueChange={(next) => onChange(next == null ? "" : String(next))} disabled={disabled}>
      <SelectTrigger size="lg" aria-label={label} className={cn("bg-card", className)} {...trigger}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Open below the trigger, not over it (Base UI's default lines the chosen item up with the trigger) */}
      <SelectContent alignItemWithTrigger={false} align={align}>
        {emptyLabel && <SelectItem value={null}>{emptyLabel}</SelectItem>}
        {Object.entries(options).map(([option, optionLabel]) => (
          <SelectItem key={option} value={option}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
