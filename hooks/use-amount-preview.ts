// hooks/use-amount-preview.ts
// Live totals for the booking form, using the same calculation as the server.
// The server recalculates on save — this is a preview only.

"use client";

import { useWatch, type Control } from "react-hook-form";
import { BookingCalculationError, calculateBookingAmounts } from "@/lib/domain/calculations";
import type { BookingAmounts } from "@/lib/domain/types";
import type { BookingFormInput } from "./use-booking-form";

export interface AmountPreview {
  travellers: number;
  ratePerPerson: number;
  discountAmount: number;
  amountPaid: number;
  amounts: BookingAmounts | null;
  /** Why totals can't be shown yet (missing or impossible values). */
  problem: string | null;
}

export function useAmountPreview(control: Control<BookingFormInput>): AmountPreview {
  const [travellers, ratePerPerson, discountAmount, amountPaid] = useWatch({
    control,
    name: ["travellers", "ratePerPerson", "discountAmount", "amountPaid"],
  });
  const values = { travellers, ratePerPerson, discountAmount, amountPaid };

  if (![travellers, ratePerPerson].every(Number.isFinite)) {
    return { ...values, amounts: null, problem: "Enter travellers and the rate to see totals." };
  }

  try {
    const amounts = calculateBookingAmounts({
      travellers,
      ratePerPerson,
      discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
      amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
    });
    return { ...values, amounts, problem: null };
  } catch (err) {
    return {
      ...values,
      amounts: null,
      problem: err instanceof BookingCalculationError ? err.message : "These amounts don't add up.",
    };
  }
}
