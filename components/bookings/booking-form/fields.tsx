// components/bookings/booking-form/fields.tsx
// Form fields bound to React Hook Form (via context): label, control,
// optional hint or character counter, and the field's error.

"use client";

import { Controller, useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { Lock } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import type { BookingFormInput } from "@/hooks/use-booking-form";
import { MoneyInput } from "./money-input";

type Name = FieldPath<BookingFormInput>;

interface BaseProps {
  name: Name;
  label: string;
  hint?: React.ReactNode;
  className?: string;
}

function FieldShell({
  name,
  label,
  hint,
  className,
  invalid,
  error,
  children,
}: BaseProps & { invalid: boolean; error?: string; children: React.ReactNode }) {
  return (
    <Field data-invalid={invalid || undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={name} className="text-[0.8125rem] font-medium text-foreground">
        {label}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError id={`${name}-error`}>{error}</FieldError>
      ) : (
        hint && <FieldDescription className="text-xs">{hint}</FieldDescription>
      )}
    </Field>
  );
}

/** Single-line text. */
export function TextField({
  name,
  label,
  hint,
  className,
  ...inputProps
}: BaseProps & Omit<React.ComponentProps<"input">, "name">) {
  const { register, getFieldState, formState } = useFormContext<BookingFormInput>();
  const { error } = getFieldState(name, formState);

  return (
    <FieldShell name={name} label={label} hint={hint} className={className} invalid={!!error} error={error?.message}>
      <InputGroup className="h-10 bg-card">
        <InputGroupInput
          id={name}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          {...inputProps}
          {...register(name)}
        />
      </InputGroup>
    </FieldShell>
  );
}

/**
 * A value the server assigns (invoice number and dates): shown like an input,
 * but read-only and outside the form's values. Empty shows the placeholder.
 */
export function ReadOnlyField({
  id,
  label,
  value,
  placeholder,
  hint,
  className,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <Field className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={id} className="text-[0.8125rem] font-medium text-foreground">
        {label}
      </FieldLabel>
      <InputGroup className="h-10 bg-muted/60">
        <InputGroupInput
          id={id}
          readOnly
          aria-readonly
          tabIndex={-1}
          value={value}
          placeholder={placeholder}
          className="tabular cursor-default text-foreground/80"
        />
        <InputGroupAddon align="inline-end">
          <Lock aria-hidden className="size-3.5 text-muted-foreground" />
        </InputGroupAddon>
      </InputGroup>
      {hint && <FieldDescription className="text-xs">{hint}</FieldDescription>}
    </Field>
  );
}

/** Date stored as DD/MM/YYYY, edited with the browser's date picker. `min` is DD/MM/YYYY too. */
export function DateField({
  name,
  label,
  hint,
  className,
  min,
}: BaseProps & { min?: string }) {
  const { control } = useFormContext<BookingFormInput>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          name={name}
          label={label}
          hint={hint}
          className={className}
          invalid={!!fieldState.error}
          error={fieldState.error?.message}
        >
          <InputGroup className="h-10 bg-card">
            <InputGroupInput
              id={name}
              type="date"
              ref={field.ref}
              value={toISODate(String(field.value ?? ""))}
              min={min ? toISODate(min) : undefined}
              onChange={(e) => field.onChange(fromISODate(e.target.value))}
              onBlur={field.onBlur}
              aria-invalid={!!fieldState.error || undefined}
              aria-describedby={fieldState.error ? `${name}-error` : undefined}
              className="tabular"
            />
          </InputGroup>
        </FieldShell>
      )}
    />
  );
}

/** Whole rupees (or a count) with Indian grouping. */
export function NumberField({
  name,
  label,
  hint,
  className,
  currency = true,
  suffix,
}: BaseProps & { currency?: boolean; suffix?: string }) {
  const { control } = useFormContext<BookingFormInput>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          name={name}
          label={label}
          hint={hint}
          className={className}
          invalid={!!fieldState.error}
          error={fieldState.error?.message}
        >
          <MoneyInput
            id={name}
            ref={field.ref}
            value={Number(field.value)}
            onChange={field.onChange}
            onBlur={field.onBlur}
            currency={currency}
            suffix={suffix}
            aria-invalid={!!fieldState.error || undefined}
            aria-describedby={fieldState.error ? `${name}-error` : undefined}
          />
        </FieldShell>
      )}
    />
  );
}

/** Multi-line text with a live character count against its limit. */
export function TextareaField({
  name,
  label,
  hint,
  className,
  maxLength,
  placeholder,
}: BaseProps & { maxLength: number; placeholder?: string }) {
  const { register, control, getFieldState, formState } = useFormContext<BookingFormInput>();
  const { error } = getFieldState(name, formState);
  const value = String(useWatch({ control, name }) ?? "");
  const over = value.length > maxLength;

  return (
    <FieldShell name={name} label={label} className={className} invalid={!!error || over} error={error?.message}>
      <Textarea
        id={name}
        rows={3}
        placeholder={placeholder}
        aria-invalid={!!error || over || undefined}
        aria-describedby={`${name}-count`}
        className="min-h-24 bg-card"
        {...register(name)}
      />
      <div className="flex items-start justify-between gap-4 text-xs text-muted-foreground">
        <span>{!error && hint}</span>
        <span id={`${name}-count`} className={cn("tabular shrink-0", over && "font-medium text-destructive")}>
          {value.length}/{maxLength}
        </span>
      </div>
    </FieldShell>
  );
}
