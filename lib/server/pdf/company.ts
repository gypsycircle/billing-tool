// lib/server/pdf/company.ts
// The fixed text of the Bill of Supply: who issues it, where to pay, and the
// terms. Wording from the original bill (docs/sample_bill.pdf), tidied for
// spacing and capitals, then reordered and reworded, with the slot booking point added.
// Edit here to change what every bill prints.

import type { PackageType } from "@/lib/domain/types";
import "server-only";

export const COMPANY = {
  name: "Gypsycircle",
  mobile: "8075759455",
  email: "info@gypsycircle.in",
} as const;

/** BANK DETAILS, as label → value rows. */
export const BANK_DETAILS: readonly (readonly [label: string, value: string])[] = [
  ["Name", "GYPSY CIRCLE"],
  ["IFSC Code", "FDRL0001413"],
  ["Account No.", "14130200026234"],
  ["Bank", "Federal Bank, Kozhikode Mavoor Road"],
];

export const UPI_ID = "gypsycircle123@fbl";

export interface Term {
  /** Printed in semibold before the text, e.g. "Payment:". */
  lead: string;
  text: string;
  /** Lettered sub-points (a., b., …) under this point. */
  points?: readonly string[];
  /** An "Important:" note after the sub-points, as bullets. */
  important?: readonly string[];
}

export const TERMS: readonly Term[] = [
  {
    lead: "Payment:",
    text: "Full payment for travel arrangements must be settled a minimum of two weeks prior to the scheduled departure date.",
  },
  {
    lead: "Slot booking amount:",
    text: "The amount paid to confirm a slot is non-refundable under any circumstances. The most we can refund is the amount paid, minus the slot booking amount.",
  },
  {
    lead: "Cancellation policy:",
    text: "",
    points: [
      "Cancellations made 30 days or more before the travel date: 75% refund of the actual package amount.",
      "Cancellations made 14 to 29 days before the travel date: 50% refund of the actual package amount.",
      "Cancellations made 7 to 13 days before the travel date: 25% refund of the actual package amount.",
      "Cancellations made less than 7 days before the travel date are non-refundable.",
    ],
  },
  {
    lead: "Refunds:",
    text: "Approved refunds will be credited within 15 working days of the cancellation being confirmed.",
  },
  {
    lead: "Postponement policy:",
    text: "",
    points: [
      "Guests are allowed one postponement per booking.",
      "The postponement request must be made at least 30 days (1 month) prior to the original travel date.",
      "The new travel date must fall within 2 months from the original travel date.",
      "Postponement is subject to availability of hotels, transport, activities and other services.",
    ],
    important: [
      "Once a package is postponed, it will not be eligible for cancellation or refund under any circumstances.",
    ],
  },
  {
    lead: "Travel documents:",
    text: "Travellers are required to carry valid personal documents, including Aadhaar, tickets and other necessary travel documents.",
  },
  {
    lead: "Liability:",
    text: "The company shall not be held responsible for delays, cancellations, natural calamities or unforeseen events.",
  },
];

/**
 * The terms a bill prints. A private package has no slot booking amount, so its
 * second term says what limits a refund instead; a group package, and a bill
 * saved before bookings had a type, print them as they are.
 */
export function termsFor(packageType: PackageType | null | undefined): readonly Term[] {
  if (packageType !== "Private") return TERMS;
  return TERMS.map((term, i) => (i === 1 ? { lead: "Refund limit:", text: "Private packages have no slot booking amount. The most we can refund is the amount paid." } : term));
}
