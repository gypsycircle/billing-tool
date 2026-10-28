// lib/server/pdf/company.ts
// The fixed text of the Bill of Supply: who issues it, where to pay, and the
// terms. Wording from the original bill (docs/sample_bill.pdf), tidied only
// for spacing and capitals. Edit here to change what every bill prints.

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

interface Term {
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
    lead: "Liability:",
    text: "The company shall not be held responsible for delays, cancellations, natural calamities or unforeseen events.",
  },
  {
    lead: "Travel documents:",
    text: "Travellers are required to carry valid personal documents, including Aadhaar, tickets and other necessary travel documents.",
  },
  {
    lead: "Refunds:",
    text: "Refunds will be credited within 15 working days.",
  },
  {
    lead: "Cancellation policy:",
    text: "",
    points: [
      "Cancellations made 1 month prior to the travel date: 75% refund of the actual package amount.",
      "Cancellations made 2 weeks prior to the travel date: 50% refund of the actual package amount.",
      "Cancellations made 1 week prior to the travel date: 25% refund of the actual package amount.",
      "Cancellations within one week of the travel date are non-refundable.",
    ],
  },
  {
    lead: "Postponement policy:",
    text: "",
    points: [
      "Guests are allowed one-time postponement of their package.",
      "The postponement request must be made at least 30 days (1 month) prior to the original travel date.",
      "The new travel date must fall within 2 months from the original travel date.",
      "Postponement is subject to availability of hotels, transport, activities and other services.",
    ],
    important: [
      "Once a package is postponed, it will not be eligible for cancellation or refund under any circumstances.",
      "Postponement can only be applied once per booking.",
    ],
  },
];
