// lib/server/records/load-for-page.ts
// For pages: a missing or malformed record id (booking, expense) renders the
// 404 page instead of the error page; an archived record's edit page goes
// back to the record (it must be restored before it can be edited).
//   const booking = await orNotFound(() => getBooking(id));
//   redirectIfArchived(booking, routes.bookings.page(booking.bookingId));

import "server-only";

import { notFound, redirect } from "next/navigation";
import { isArchived } from "@/lib/domain/records";
import { NotFoundError } from "../errors";

export async function orNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export function redirectIfArchived(record: Parameters<typeof isArchived>[0], href: string): void {
  if (isArchived(record)) redirect(href);
}
