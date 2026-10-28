// hooks/use-booking-form.ts
// React Hook Form setup for creating/editing a booking, validated with the same
// Zod schema the API uses. Also:
//   • works out the due date shown (read-only): max(trip start − 14 days,
//     invoice date), re-worked out as the trip start changes; the server
//     assigns the same value on save
//   • maps server field errors (422) onto fields

"use client";

import { useCallback, useMemo } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { bookingDraftSchema, bookingFormSchema } from "@/lib/domain/booking.schema";
import { defaultDueDate, isValidDDMMYYYY } from "@/lib/domain/dates";
import type { BookingDraft } from "@/lib/domain/types";
import type { BookingFormInput, BookingFormValues, InvoiceInfo } from "@/components/bookings/booking-form/defaults";

export type { BookingFormInput, BookingFormValues };

const BOOKING_FIELDS = Object.keys(bookingDraftSchema.shape) as (keyof BookingDraft)[];

export function useBookingForm(defaultValues: BookingFormInput, mode: "create" | "edit", invoice: InvoiceInfo) {
  // When editing, unchanged trip dates are accepted even if they aren't after the invoice date
  const savedTripStart = mode === "edit" ? String(defaultValues.tripStartDate ?? "") : undefined;
  const savedTripEnd = mode === "edit" ? String(defaultValues.tripEndDate ?? "") : undefined;
  const resolver = useMemo(
    () => zodResolver(bookingFormSchema(invoice.date, { tripStartDate: savedTripStart, tripEndDate: savedTripEnd })),
    [invoice.date, savedTripStart, savedTripEnd]
  );
  const form = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver,
    defaultValues,
    mode: "onTouched",
  });
  const { control, setError } = form;

  // ── Due date (read-only) ──────────────────────────────────────────────
  const tripStartDate = String(useWatch({ control, name: "tripStartDate" }) ?? "");
  const dueDate =
    tripStartDate === savedTripStart || !isValidDDMMYYYY(tripStartDate)
      ? invoice.dueDate
      : defaultDueDate(tripStartDate, invoice.date);

  // ── Server errors → fields ────────────────────────────────────────────
  const applyServerErrors = useCallback(
    (status: number | null, error: string | null, fieldErrors: Record<string, string>) => {
      let mapped = false;
      for (const [field, message] of Object.entries(fieldErrors)) {
        if ((BOOKING_FIELDS as string[]).includes(field)) {
          setError(field as FieldPath<BookingFormInput>, { type: "server", message }, { shouldFocus: !mapped });
          mapped = true;
        }
      }
      if (status === 412 && error) {
        // Someone else saved this booking after it was opened: never overwrite it
        toast.error(error, {
          duration: Infinity,
          action: { label: "Reload", onClick: () => window.location.reload() },
        });
        return;
      }
      if (!mapped && error) toast.error(error);
    },
    [setError]
  );

  return { form, dueDate, tripStartDate, applyServerErrors };
}
