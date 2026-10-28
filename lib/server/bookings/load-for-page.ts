// lib/server/bookings/load-for-page.ts
// For pages: a missing or malformed booking id renders the 404 page.

import "server-only";

import { notFound } from "next/navigation";
import type { Booking } from "@/lib/domain/types";
import { BookingNotFoundError } from "../errors";
import { getBooking } from "./service";

export async function loadBookingOrNotFound(id: string): Promise<Booking> {
  try {
    return await getBooking(id);
  } catch (err) {
    if (err instanceof BookingNotFoundError) notFound();
    throw err;
  }
}
