// components/bookings/booking-form/booking-form.tsx
// Create / edit a booking. Sections follow the Bill of Supply; the live
// receipt previews the totals. Validation is the same Zod schema the API uses,
// and the server recalculates everything on save.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, type FieldNamesMarkedBoolean } from "react-hook-form";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BOOKING_VERSION_HEADER, type BookingDraft, type BookingRef } from "@/lib/domain/types";
import { useAmountPreview } from "@/hooks/use-amount-preview";
import { useApiMutation } from "@/hooks/use-api-mutation";
import {
  useBookingForm,
  type BookingFormInput,
  type BookingFormValues,
} from "@/hooks/use-booking-form";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { addDays, compareDDMMYYYY, isValidDDMMYYYY } from "@/lib/domain/dates";
import type { InvoiceInfo } from "./defaults";
import { DateField, NumberField, ReadOnlyField, TextareaField, TextField } from "./fields";
import { FormSection } from "./form-section";
import { LiveReceipt } from "./live-receipt";

type BookingFormProps =
  | { mode: "create"; defaultValues: BookingFormInput; invoice: InvoiceInfo }
  | {
      mode: "edit";
      defaultValues: BookingFormInput;
      invoice: InvoiceInfo;
      bookingId: string;
      /** The booking's updatedAt when the form was opened — sent as X-Booking-Version. */
      version: string;
    };

/** Only the fields the user changed (edit sends a minimal PATCH). */
function changedFields(
  values: BookingFormValues,
  dirty: Partial<Readonly<FieldNamesMarkedBoolean<BookingFormInput>>>
): Partial<BookingDraft> {
  const changes: Partial<Record<keyof BookingDraft, unknown>> = {};
  for (const key of Object.keys(dirty) as (keyof BookingDraft)[]) {
    if (dirty[key]) changes[key] = values[key];
  }
  return changes as Partial<BookingDraft>;
}

export function BookingForm(props: BookingFormProps) {
  const { mode, defaultValues, invoice } = props;
  const router = useRouter();
  const { form, dueDate, tripStartDate, applyServerErrors } = useBookingForm(defaultValues, mode, invoice);
  // Trip dates are offered from the day after the invoice date; the end from the start on
  const firstTripDay = addDays(invoice.date, 1);
  const firstEndDay =
    isValidDDMMYYYY(tripStartDate) && compareDDMMYYYY(tripStartDate, firstTripDay) > 0 ? tripStartDate : firstTripDay;
  const { control, handleSubmit, formState } = form;
  const preview = useAmountPreview(control);
  const { mutate, pending } = useApiMutation<{ booking: BookingRef }>();
  const [saved, setSaved] = useState(false);
  // One key per form visit: a retried or double-sent create returns the first booking.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useUnsavedChanges(formState.isDirty && !saved);

  const onSubmit = handleSubmit(async (values) => {
    const result =
      props.mode === "create"
        ? await mutate("/api/bookings", {
            method: "POST",
            body: values,
            headers: { "Idempotency-Key": idempotencyKey },
            toastOnError: false,
          })
        : await mutate(`/api/bookings/${props.bookingId}`, {
            method: "PATCH",
            body: changedFields(values, formState.dirtyFields),
            headers: { [BOOKING_VERSION_HEADER]: props.version },
            toastOnError: false,
          });
    if (!result) return; // a submit was already in flight

    if (result.data) {
      setSaved(true);
      const { booking } = result.data;
      toast.success(
        mode === "create" ? `Booking No. ${booking.invoiceNumber} created` : `Booking No. ${booking.invoiceNumber} updated`
      );
      router.push(`/bookings/${booking.bookingId}`);
      router.refresh();
    } else {
      applyServerErrors(result.status, result.error, result.fieldErrors);
    }
  });

  const submitLabel = mode === "create" ? "Create booking" : "Save changes";
  const cancelHref = props.mode === "edit" ? `/bookings/${props.bookingId}` : "/bookings";
  const canSubmit = !pending && !saved && (mode === "create" || formState.isDirty);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <div className="space-y-8">
          <FormSection number="01" title="Invoice" description="Printed in the grey band at the top of the bill.">
            <ReadOnlyField
              id="invoiceNumber"
              label="Invoice No."
              value={invoice.number}
              hint={mode === "create" ? "The next free number, confirmed when you save." : undefined}
              className="sm:col-span-2 sm:max-w-[14rem]"
            />
            <ReadOnlyField id="invoiceDate" label="Invoice date" value={invoice.date} hint={mode === "create" ? "Today." : undefined} />
            <ReadOnlyField
              id="dueDate"
              label="Due date"
              value={dueDate}
              placeholder="dd/mm/yyyy"
              hint="14 days before the trip starts (not before the invoice date)."
            />
          </FormSection>

          <FormSection number="02" title="Customer" description="Printed under BILL TO.">
            <TextField name="customerName" label="Customer name" autoComplete="off" />
            <TextField name="customerPhone" label="Mobile" type="tel" inputMode="tel" autoComplete="off" />
            <TextField
              name="customerEmail"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="name@example.com"
              hint="Optional. Not printed — the bill will be emailed here."
              className="sm:col-span-2"
            />
          </FormSection>

          <FormSection number="03" title="Trip" description="The service line and BATCH column on the bill.">
            <TextField name="packageName" label="Package / service" placeholder="e.g. DELHI - AGRA PACKAGE" className="sm:col-span-2" />
            <TextField name="destination" label="Destination" hint="Used for search and filters — not printed." />
            <TextField name="batchName" label="Batch" placeholder="e.g. 19TH JAN DELHI" />
            <DateField name="tripStartDate" label="Trip starts" min={firstTripDay} />
            <DateField name="tripEndDate" label="Trip ends" min={firstEndDay} />
            <TextField name="routeDescription" label="Route" placeholder="e.g. Agra-Delhi-Manali-Kasol" hint="Shown in brackets after the dates." className="sm:col-span-2" />
          </FormSection>

          <FormSection number="04" title="Pricing" description="Whole rupees. Totals are calculated for you.">
            <NumberField name="travellers" label="Travellers" currency={false} suffix="PERSON" />
            <NumberField name="ratePerPerson" label="Rate per person" />
            <NumberField name="discountAmount" label="Discount" hint="Total discount in rupees." />
          </FormSection>

          <FormSection number="05" title="Payment" description="Everything received so far.">
            <NumberField name="amountPaid" label="Amount received" />
          </FormSection>

          <FormSection number="06" title="Notes">
            <TextareaField
              name="invoiceNote"
              label="Invoice note"
              maxLength={300}
              hint="Printed under NOTES on the bill."
              placeholder="e.g. COMPLIMENTARY FOR 5 PAX HAS BEEN ADDED."
              className="sm:col-span-2"
            />
            <TextareaField
              name="internalNotes"
              label="Internal note"
              maxLength={500}
              hint="For the team only — never printed."
              className="sm:col-span-2"
            />
          </FormSection>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <LiveReceipt preview={preview} />
          <div className="mt-4 flex flex-col gap-2">
            <Button type="submit" size="lg" className="h-11 w-full" disabled={!canSubmit}>
              {pending || saved ? <Loader2 className="animate-spin" /> : <Check />}
              {pending ? "Saving…" : submitLabel}
            </Button>
            <Button variant="ghost" size="lg" className="w-full text-muted-foreground" nativeButton={false} render={<Link href={cancelHref} />}>
              Cancel
            </Button>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Saved straight to the database.
            </p>
          </div>
        </aside>
      </form>
    </FormProvider>
  );
}
