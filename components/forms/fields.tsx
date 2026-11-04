// components/forms/fields.tsx
// Form fields bound to React Hook Form (via context): label, control,
// optional hint or character counter, and the field's error. Shared by every
// form; `formFields<Values>()` gives a form versions whose `name` is checked
// against its own values.

"use client";

import { Controller, useFormContext, useWatch, type FieldPath, type FieldValues } from "react-hook-form";
import { Lock } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { DatePicker } from "@/components/shared/date-picker";
import { OptionSelect } from "@/components/shared/option-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MoneyInput } from "./money-input";

const FIELD_LABEL = "text-[0.8125rem] font-medium text-foreground";

interface BaseProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  hint?: React.ReactNode;
  /** The save refuses it empty: the label gets a red mark. */
  required?: boolean;
  className?: string;
}

function FieldShell({
  name,
  label,
  hint,
  required,
  className,
  invalid,
  error,
  children,
}: BaseProps<FieldValues> & { invalid: boolean; error?: string; children: React.ReactNode }) {
  return (
    <Field data-invalid={invalid || undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={name} className={FIELD_LABEL}>
        <span>
          {label}
          {required && (
            <>
              <span aria-hidden className="ml-0.5 text-destructive">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </span>
      </FieldLabel>
      {children}
      {error && <FieldError id={`${name}-error`}>{error}</FieldError>}
      {hint && <FieldDescription className="text-xs">{hint}</FieldDescription>}
    </Field>
  );
}

/** Single-line text. */
export function TextField<T extends FieldValues = FieldValues>({
  name,
  label,
  hint,
  required,
  className,
  ...inputProps
}: BaseProps<T> & Omit<React.ComponentProps<"input">, "name">) {
  const { register, getFieldState, formState } = useFormContext<T>();
  const { error } = getFieldState(name, formState);

  return (
    <FieldShell name={name} label={label} hint={hint} required={required} className={className} invalid={!!error} error={error?.message}>
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
 * A value the server assigns (invoice or expense number, dates): shown like an
 * input, but read-only and outside the form's values. Empty shows the placeholder.
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
      <FieldLabel htmlFor={id} className={FIELD_LABEL}>
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

/** Date stored as DD/MM/YYYY, picked with DatePicker (a calendar). `min` / `max` are DD/MM/YYYY too: the days outside are disabled. */
export function DateField<T extends FieldValues = FieldValues>({
  name,
  label,
  hint,
  required,
  className,
  min,
  max,
}: BaseProps<T> & { min?: string; max?: string }) {
  const { control } = useFormContext<T>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          name={name}
          label={label}
          hint={hint}
          required={required}
          className={className}
          invalid={!!fieldState.error}
          error={fieldState.error?.message}
        >
          <DatePicker
            id={name}
            ref={field.ref}
            value={String(field.value ?? "")}
            min={min}
            max={max}
            onChange={field.onChange}
            onClose={field.onBlur}
            invalid={!!fieldState.error}
            describedBy={fieldState.error ? `${name}-error` : undefined}
          />
        </FieldShell>
      )}
    />
  );
}

/** Whole rupees (or a count) with Indian grouping. */
export function NumberField<T extends FieldValues = FieldValues>({
  name,
  label,
  hint,
  required,
  className,
  currency = true,
  suffix,
  disabled,
}: BaseProps<T> & { currency?: boolean; suffix?: string; disabled?: boolean }) {
  const { control } = useFormContext<T>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          name={name}
          label={label}
          hint={hint}
          required={required}
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
            disabled={disabled}
            aria-invalid={!!fieldState.error || undefined}
            aria-describedby={fieldState.error ? `${name}-error` : undefined}
          />
        </FieldShell>
      )}
    />
  );
}

/**
 * One choice from a fixed list: `options` maps each value to its label.
 */
export function SelectField<T extends FieldValues = FieldValues>({
  name,
  label,
  hint,
  required,
  className,
  options,
  placeholder = "Choose…",
  disabled,
}: BaseProps<T> & { options: Readonly<Record<string, string>>; placeholder?: string; disabled?: boolean }) {
  const { control } = useFormContext<T>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          name={name}
          label={label}
          hint={hint}
          required={required}
          className={className}
          invalid={!!fieldState.error}
          error={fieldState.error?.message}
        >
          <OptionSelect
            options={options}
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder={placeholder}
            disabled={disabled}
            className="h-10 w-full"
            trigger={{
              id: name,
              ref: field.ref,
              onBlur: field.onBlur,
              "aria-invalid": !!fieldState.error || undefined,
              "aria-describedby": fieldState.error ? `${name}-error` : undefined,
            }}
          />
        </FieldShell>
      )}
    />
  );
}

/** Multi-line text with a live character count against its limit. */
export function TextareaField<T extends FieldValues = FieldValues>({
  name,
  label,
  hint,
  required,
  className,
  maxLength,
  placeholder,
}: BaseProps<T> & { maxLength: number; placeholder?: string }) {
  const { register, control, getFieldState, formState } = useFormContext<T>();
  const { error } = getFieldState(name, formState);
  const value = String(useWatch({ control, name }) ?? "");
  const over = value.length > maxLength;

  return (
    <FieldShell name={name} label={label} required={required} className={className} invalid={!!error || over} error={error?.message}>
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
        <span>{hint}</span>
        <span id={`${name}-count`} className={cn("tabular shrink-0", over && "font-medium text-destructive")}>
          {value.length}/{maxLength}
        </span>
      </div>
    </FieldShell>
  );
}

/** The fields, with `name` checked against one form's values: `const f = formFields<BookingFormInput>()`. */
export function formFields<T extends FieldValues>() {
  return {
    TextField: TextField<T>,
    DateField: DateField<T>,
    NumberField: NumberField<T>,
    SelectField: SelectField<T>,
    TextareaField: TextareaField<T>,
  };
}
