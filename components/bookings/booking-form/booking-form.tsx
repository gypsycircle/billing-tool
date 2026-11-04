// components/bookings/booking-form/booking-form.tsx
// Create / edit a booking. Sections follow the Bill of Supply; the live
// receipt previews the totals. Destination, package and route are picked from
// the Settings lists, and who closed it from the team. Validation is the same Zod schema the API uses, and the
// server recalculates everything on save.

"use client";

import { PACKAGE_TYPES } from "@/lib/domain/types";
import { BILL_NOTE_MAX_LINES, BILL_NOTE_MAX_WORDS, billNoteCounts, invoiceDateChoices } from "@/lib/domain/booking.schema";
import { formFields, ReadOnlyField } from "@/components/forms/fields";
import { FormSection } from "@/components/forms/form-section";
import { ListSelectField } from "@/components/forms/list-select-field";
import { RecordFormLayout } from "@/components/forms/record-form-layout";
import type { BookingRef } from "@/lib/domain/types";
import { useAmountPreview } from "@/hooks/use-amount-preview";
import { useBookingForm, type BookingFormInput } from "@/hooks/use-booking-form";
import { useRecordFormSubmit } from "@/hooks/use-record-form-submit";
import { changedFields } from "@/lib/client/changed-fields";
import { addDays, compareDDMMYYYY, isValidDDMMYYYY } from "@/lib/domain/dates";
import {
  BOOKING_LIST_FIELDS,
  bookingListChoices,
  GENERAL_KINDS,
  routeChoices,
  type BookingListField,
  type BookingListOptions,
} from "@/lib/domain/general";
import { routes } from "@/lib/domain/routes";
import type { InvoiceInfo } from "./defaults";
import { LiveReceipt } from "./live-receipt";

const { DateField, NumberField, SelectField, TextareaField, TextField } = formFields<BookingFormInput>();

/** What an edit sends: the changed fields, with the route's two always together, as the server reads them as one. */
const ROUTE_PAIR = ["routeDescription", "routeOther"] as const;

function editChanges(values: BookingFormInput, dirty: Parameters<typeof changedFields>[1]): Partial<BookingFormInput> {
  const changes = changedFields(values, dirty);
  if (ROUTE_PAIR.some((key) => key in changes)) for (const key of ROUTE_PAIR) Object.assign(changes, { [key]: values[key] });
  return changes;
}

const PACKAGE_TYPE_CHOICES = Object.fromEntries(PACKAGE_TYPES.map((type) => [type, `${type} package`]));

type BookingFormProps =
  | {
      mode: "create";
      defaultValues: BookingFormInput;
      invoice: InvoiceInfo;
      lists: BookingListOptions;
      closedBy: Readonly<Record<string, string>>;
      /** The number expected for each date the booking can have. */
      numbers: Readonly<Record<string, string>>;
    }
  | {
      mode: "edit";
      defaultValues: BookingFormInput;
      invoice: InvoiceInfo;
      lists: BookingListOptions;
      closedBy: Readonly<Record<string, string>>;
      bookingId: string;
      /** A cancelled booking's money stays as it is until it's reactivated. */
      moneyLocked?: boolean;
      /** The booking's updatedAt when the form was opened — sent as X-Record-Version. */
      version: string;
    };

export function BookingForm(props: BookingFormProps) {
  const { mode, defaultValues, invoice, lists, closedBy } = props;
  const { form, dueDate, invoiceDate, invoiceNote, packageType, routeIsTyped, tripStartDate, applyServerErrors } = useBookingForm(defaultValues, mode, invoice);
  // Trip dates are offered from the day after the invoice date; the end from the start on
  const firstTripDay = addDays(isValidDDMMYYYY(invoiceDate) ? invoiceDate : invoice.date, 1);
  const firstEndDay =
    isValidDDMMYYYY(tripStartDate) && compareDDMMYYYY(tripStartDate, firstTripDay) > 0 ? tripStartDate : firstTripDay;
  const preview = useAmountPreview(form.control);
  const moneyLocked = props.mode === "edit" && props.moneyLocked;
  const submit = useRecordFormSubmit<BookingFormInput, BookingFormInput, { booking: BookingRef }>({
    form,
    target:
      props.mode === "create"
        ? { mode: "create", url: routes.api.bookings.list }
        : { mode: "edit", url: routes.api.bookings.one(props.bookingId), version: props.version },
    applyServerErrors,
    editBody: editChanges,
    onSaved: ({ booking }) => ({
      message: `Booking No. ${booking.invoiceNumber} ${mode === "create" ? "created" : "updated"}.`,
      href: routes.bookings.page(booking.bookingId),
    }),
  });

  /** Package, destination and route come from their Settings lists; the saved value stays offered. */
  const listField = (field: Exclude<BookingListField, "routeDescription">, label: string, extra: { className?: string }) => (
    <ListSelectField<BookingFormInput>
      name={field}
      label={label}
      choices={bookingListChoices(lists[field], defaultValues[field])}
      list={BOOKING_LIST_FIELDS[field]}
      things={GENERAL_KINDS[BOOKING_LIST_FIELDS[field]].title.toLowerCase()}
      required
      {...extra}
    />
  );

  const noteCounts = billNoteCounts(invoiceNote);

  return (
    <RecordFormLayout
      form={form}
      onSubmit={submit.onSubmit}
      summary={<LiveReceipt preview={preview} />}
      submit={{
        ...submit,
        label: mode === "create" ? "Create booking" : "Save changes",
        cancelHref: props.mode === "edit" ? routes.bookings.page(props.bookingId) : routes.bookings.list,
      }}
    >
      <FormSection number="01" title="Invoice" description="Its number and due date are set for you when you save.">
        <ReadOnlyField
          id="invoiceNumber"
          label="Invoice No."
          value={props.mode === "create" ? (props.numbers[invoiceDate] ?? invoice.number) : invoice.number}
          hint={mode === "create" ? "The next free number, confirmed when you save." : undefined}
        />
        <ListSelectField<BookingFormInput> name="closedById" label="Lead closed by" placeholder="Choose who closed it…" choices={closedBy} list="team" things="Sales team members" required />
        {mode === "create" ? (
          <DateField name="invoiceDate" label="Invoice date" min={invoiceDateChoices(invoice.date).at(-1)} max={invoice.date} required />
        ) : (
          <ReadOnlyField id="invoiceDate" label="Invoice date" value={invoice.date} />
        )}
        <ReadOnlyField
          id="dueDate"
          label="Due date"
          value={dueDate}
          placeholder="dd/mm/yyyy"
          hint="14 days before the trip starts (not before the invoice date)."
        />
      </FormSection>

      <FormSection number="02" title="Customer" description="Who the booking is for, and how to reach them.">
        <TextField name="customerName" label="Customer name" autoComplete="off" required />
        <TextField name="customerPhone" label="Mobile" type="tel" inputMode="tel" autoComplete="off" required />
        <TextField
          name="customerEmail"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="name@example.com"
          hint="Optional. Not printed on the bill."
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection number="03" title="Trip" description="Where they're going, and when.">
        {listField("packageName", "Package", { className: "sm:col-span-2" })}
        <SelectField
          name="packageType"
          label="Package type"
          options={PACKAGE_TYPE_CHOICES}
          placeholder="Choose Group or Private"
          hint="A group package takes a slot amount; a private one has none."
          required
          disabled={moneyLocked && Boolean(defaultValues.packageType)}
          className="sm:col-span-2"
        />
        {listField("destination", "Destination", {})}
        <TextField name="batchName" label="Batch" placeholder="e.g. 19TH JAN DELHI" required />
        <DateField name="tripStartDate" label="Trip starts" min={firstTripDay} required />
        <DateField name="tripEndDate" label="Trip ends" min={firstEndDay} required />
        <ListSelectField<BookingFormInput>
          name="routeDescription"
          label="Route"
          choices={routeChoices(lists.routeDescription, defaultValues.routeDescription)}
          list="route"
          things="routes"
          note="Shown in brackets after the dates."
          alternative="Pick Other"
          required
          className="sm:col-span-2"
        />
        {routeIsTyped && <TextField name="routeOther" label="Type the route" placeholder="e.g. Kochi-Munnar-Thekkady" maxLength={200} autoComplete="off" required className="sm:col-span-2" />}
      </FormSection>

      <FormSection number="04" title="Pricing" description="What each traveller pays, less any discount, in whole rupees.">
        <NumberField name="travellers" label="Travellers" currency={false} suffix="PERSON" required disabled={moneyLocked} />
        <NumberField name="ratePerPerson" label="Rate per person" required disabled={moneyLocked} />
        <NumberField name="discountAmount" label="Discount" hint="Total discount in rupees." required disabled={moneyLocked} />
      </FormSection>

      <FormSection number="05" title="Payment" description="What the customer has paid so far.">
        {packageType === "Group" && <NumberField name="slotAmount" label="Slot amount" hint="Non-refundable if the trip is cancelled." required disabled={moneyLocked} />}
        <NumberField name="amountPaid" label="Amount received" required disabled={moneyLocked} />
      </FormSection>

      <FormSection number="06" title="Notes">
        <TextareaField
          name="invoiceNote"
          label="Invoice note"
          maxLength={300}
          hint={`Printed under NOTES on the bill. ${noteCounts.words} of ${BILL_NOTE_MAX_WORDS} words, ${noteCounts.lines} of ${BILL_NOTE_MAX_LINES} lines.`}
          placeholder="e.g. complimentary for 5 pax has been added."
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
    </RecordFormLayout>
  );
}
