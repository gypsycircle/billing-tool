// hooks/use-url-filters.ts
// Reads and writes a list's filters in the URL (bookings, expenses, the
// Settings' team and lists), so filtered views can be bookmarked, survive
// reloads, and are applied on the server. Changing a filter goes back to the
// first page. On a page with several lists (Settings) each has its own page
// and archived parameters (`pageParam`, `archivedParam`), and Reset clears
// only its own list's `keys`.

"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useUrlFilters<K extends string>(
  keys: readonly K[],
  { pageParam = "page", archivedParam = "archived" }: { pageParam?: string; archivedParam?: string } = {}
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const get = useCallback((key: K) => searchParams.get(key) ?? "", [searchParams]);

  /** Sets (or clears, with "") one or more filters and updates the URL. */
  const set = useCallback(
    (changes: Partial<Record<K, string>>) => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete(pageParam);
      for (const [key, value] of Object.entries(changes) as [K, string | undefined][]) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams, pageParam]
  );

  /** Clears this list's filters (and its page); anything else in the URL stays. */
  const clear = useCallback(() => set(Object.fromEntries(keys.map((k) => [k, ""])) as Partial<Record<K, string>>), [keys, set]);

  const hasAny = keys.some((k) => searchParams.has(k));
  /** The list shows archived records only (?archived=1, or its own `archivedParam`). */
  const archived = searchParams.get(archivedParam) === "1";

  return { get, set, clear, hasAny, isPending, archived };
}
