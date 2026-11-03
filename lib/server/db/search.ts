// lib/server/db/search.ts
// A list's search box (bookings, the team): the user's text matched literally.

import "server-only";

/** A user's search text as a literal, case-insensitive pattern (never a regex they wrote). */
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches `text` anywhere in any of `fields` (case-insensitive, literally). */
export const searchAny = (fields: readonly string[], text: string) => {
  const pattern = new RegExp(escapeRegex(text), "i");
  return fields.map((field) => ({ [field]: pattern }));
};
