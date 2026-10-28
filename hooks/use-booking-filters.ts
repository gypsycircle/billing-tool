// hooks/use-booking-filters.ts
// Reads and writes the dashboard filters in the URL, so filtered views can be
// bookmarked, survive reloads, and are applied on the server. Changing a
// filter goes back to the first page.

"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterKey = "q" | "destination" | "payment" | "status" | "archived" | "due";

const FILTER_KEYS: readonly FilterKey[] = ["q", "destination", "payment", "status", "archived", "due"];

export function useBookingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const get = useCallback((key: FilterKey) => searchParams.get(key) ?? "", [searchParams]);

  /** Sets (or clears, with "") one or more filters and updates the URL. */
  const set = useCallback(
    (changes: Partial<Record<FilterKey, string>>) => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("page");
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const clear = useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  const hasAny = FILTER_KEYS.some((k) => searchParams.has(k));

  return { get, set, clear, hasAny, isPending };
}
