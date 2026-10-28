// lib/domain/calculations.ts
// Booking pricing — the single source for every derived amount.
//   gross    = travellers × rate per person
//   discount % = discount ÷ gross × 100 (2 dp, 0 when gross is 0)
//   total    = gross − discount
//   balance  = total − amount paid
//   status   = Unpaid (paid 0) | Partial | Paid (paid = total)
// Used for live previews in the browser; the server recalculates before
// every write, on every read, and before generating a PDF.

import type { BookingAmounts, PaymentStatus, PricingInput } from "./types";

export class BookingCalculationError extends Error {
  constructor(
    message: string,
    readonly field: keyof PricingInput
  ) {
    super(message);
    this.name = "BookingCalculationError";
  }
}

function assertWholeRupees(value: number, field: keyof PricingInput, min: number): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new BookingCalculationError(
      `${field} must be a whole number of at least ${min}.`,
      field
    );
  }
}

export function calculateBookingAmounts({
  travellers,
  ratePerPerson,
  discountAmount,
  amountPaid,
}: PricingInput): BookingAmounts {
  assertWholeRupees(travellers, "travellers", 1);
  assertWholeRupees(ratePerPerson, "ratePerPerson", 0);
  assertWholeRupees(discountAmount, "discountAmount", 0);
  assertWholeRupees(amountPaid, "amountPaid", 0);

  const grossAmount = travellers * ratePerPerson;
  if (discountAmount > grossAmount) {
    throw new BookingCalculationError("Discount cannot exceed the gross amount.", "discountAmount");
  }

  const totalAmount = grossAmount - discountAmount;
  if (amountPaid > totalAmount) {
    throw new BookingCalculationError("Amount paid cannot exceed the total amount.", "amountPaid");
  }

  const discountPercentage =
    grossAmount > 0 ? Math.round((discountAmount / grossAmount) * 10_000) / 100 : 0;

  let paymentStatus: PaymentStatus;
  if (amountPaid === 0) paymentStatus = "Unpaid";
  else if (amountPaid === totalAmount) paymentStatus = "Paid";
  else paymentStatus = "Partial";

  return {
    grossAmount,
    discountPercentage,
    totalAmount,
    balanceAmount: totalAmount - amountPaid,
    paymentStatus,
  };
}
