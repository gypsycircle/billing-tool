// lib/server/db/paging.ts
// Paging a list (bookings, expenses): the requested page is fetched in
// parallel with the count of matches; a page past the end is clamped to the
// last page (one more query), and "Showing 16–30 of 42" is worked out here.

import "server-only";

import type { PageInfo } from "@/lib/domain/filters";

/** 1-based page from the URL (anything below 1 is 1). */
export const requestedPage = (page: number) => Math.max(1, Math.floor(page) || 1);

/**
 * The page to show, given the rows fetched for `page` and the number of
 * matches. `fetchPage(page)` is only called again when `page` was past the end.
 */
export async function clampPage<Row>(
  page: number,
  pageSize: number,
  fetched: Row[],
  count: number,
  fetchPage: (page: number) => Promise<Row[]>
): Promise<{ items: Row[] } & PageInfo> {
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  let shown = page;
  let items = fetched;
  if (page > pageCount) {
    shown = pageCount;
    items = count === 0 ? [] : await fetchPage(shown);
  }
  const from = count === 0 ? 0 : (shown - 1) * pageSize + 1;
  return { items, page: shown, pageCount, from, to: from === 0 ? 0 : from + items.length - 1, total: count };
}

/** An aggregation's single grouped result, without its _id (undefined when nothing matched). */
export function stripId<T extends { _id: unknown }>(value: T | undefined): Omit<T, "_id"> | undefined {
  if (!value) return undefined;
  const { _id, ...rest } = value;
  void _id;
  return rest;
}
