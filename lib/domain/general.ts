// lib/domain/general.ts
// The general lists behind the app's dropdowns: destinations, packages and
// routes (the booking form), marketing channels (marketing expenses) and roles
// (the team form).
// Bookings and expenses store the chosen name itself, so renaming or
// archiving an item later never rewrites what was already saved.

import { nameKeyOf, type NamedRecord } from "./named-records";

export const GENERAL_KINDS = {
  destination: { title: "Destinations", one: "destination", max: 100 },
  package: { title: "Packages", one: "package", max: 150 },
  route: { title: "Routes", one: "route", max: 200 },
  marketing: { title: "Marketing channels", one: "marketing channel", max: 80 },
  role: { title: "Roles", one: "role", max: 50 },
} as const satisfies Record<string, { title: string; one: string; max: number }>;

export type GeneralKind = keyof typeof GENERAL_KINDS;
export const GENERAL_KIND_IDS = Object.keys(GENERAL_KINDS) as [GeneralKind, ...GeneralKind[]];

export interface GeneralItem extends NamedRecord {
  kind: GeneralKind;
}

/** What the user enters. */
export type GeneralItemDraft = Pick<GeneralItem, "kind" | "name">;

/** The booking fields picked from a list, and which list each comes from. */
export const BOOKING_LIST_FIELDS = { destination: "destination", packageName: "package", routeDescription: "route" } as const satisfies Record<
  string,
  GeneralKind
>;
export type BookingListField = keyof typeof BOOKING_LIST_FIELDS;
export const BOOKING_LIST_FIELD_IDS = Object.keys(BOOKING_LIST_FIELDS) as BookingListField[];

/** Each booking list field's dropdown: the active items' names, by name. */
export type BookingListOptions = Record<BookingListField, string[]>;

/**
 * A booking field's dropdown choices (value → label; the value is the name
 * the booking stores). A saved value keeps its own spelling, so an unchanged
 * field saves unchanged, and one no longer in the list is still offered,
 * marked as such.
 */
export function bookingListChoices(names: readonly string[], saved = ""): Record<string, string> {
  const savedKey = saved ? nameKeyOf(saved) : null;
  const choices: Record<string, string> = Object.fromEntries(names.map((name) => [nameKeyOf(name) === savedKey ? saved : name, name]));
  if (saved && !(saved in choices)) choices[saved] = `${saved} · Not in the list`;
  return choices;
}

/**
 * The Route dropdown's "Other": the booking stores the route typed in
 * (`routeOther`) in its place, and the Routes list stays as it is. Never stored.
 */
export const ROUTE_OTHER = "__other__";

/** The Route dropdown's choices: the list, then Other. `chosen` is what the form opened with. */
export function routeChoices(names: readonly string[], chosen = ""): Record<string, string> {
  return { ...bookingListChoices(names, chosen === ROUTE_OTHER ? "" : chosen), [ROUTE_OTHER]: "Other (type the route)" };
}

/** How a saved route opens in the form: chosen when it's in the list, otherwise as Other with its text. */
export function routeFormValues(saved: string, names: readonly string[]): { routeDescription: string; routeOther: string } {
  const listed = !saved || names.some((name) => nameKeyOf(name) === nameKeyOf(saved));
  return listed ? { routeDescription: saved, routeOther: "" } : { routeDescription: ROUTE_OTHER, routeOther: saved };
}
