// components/bookings/booking-form/money-input.tsx
// Whole-number input that shows Indian grouping (3,50,000) when not being
// edited, and plain digits while focused (so the caret never jumps).
// Focusing selects the amount, so typing replaces it.
// Value: a number, or NaN when empty.

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { formatAmount } from "@/lib/domain/money";

interface MoneyInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
  /** Show the ₹ prefix (default true). */
  currency?: boolean;
  suffix?: string;
}

export function MoneyInput({
  value,
  onChange,
  onFocus,
  onBlur,
  onMouseUp,
  onKeyDown,
  ref,
  currency = true,
  suffix,
  ...props
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** The mouseup that follows a click-to-focus would clear the selection: skip it once. */
  const keepSelection = useRef(false);
  const display = Number.isFinite(value) ? (focused ? String(value) : formatAmount(value)) : "";

  // Select after the focused re-render (grouped → plain digits), not before it
  useLayoutEffect(() => {
    if (focused) inputRef.current?.select();
  }, [focused]);

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <InputGroup className="h-10 bg-card">
      {currency && (
        <InputGroupAddon>
          <InputGroupText className="text-muted-foreground">₹</InputGroupText>
        </InputGroupAddon>
      )}
      <InputGroupInput
        {...props}
        ref={setRefs}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onFocus={(e) => {
          keepSelection.current = true;
          setFocused(true);
          onFocus?.(e);
        }}
        onMouseUp={(e) => {
          if (keepSelection.current) e.preventDefault();
          keepSelection.current = false;
          onMouseUp?.(e);
        }}
        onKeyDown={(e) => {
          keepSelection.current = false;
          onKeyDown?.(e);
        }}
        onBlur={(e) => {
          keepSelection.current = false;
          setFocused(false);
          onBlur?.(e);
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          onChange(digits === "" ? Number.NaN : Number(digits));
        }}
        className="tabular"
      />
      {suffix && (
        <InputGroupAddon align="inline-end">
          <InputGroupText className="text-muted-foreground">{suffix}</InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
