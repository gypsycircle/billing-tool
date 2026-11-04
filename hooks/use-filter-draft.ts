// hooks/use-filter-draft.ts
// The choices in a filter modal before Apply (FilterDialog). It reads and
// sets like useUrlFilters, so a list's rules between filters work the same way;
// nothing reaches the URL, or the server, until Apply or Reset. The modal drops
// the choices (discard) once it has faded out, so nothing in it moves before that.

"use client";

import { useState } from "react";

export function useFilterDraft<K extends string>(
  url: { get: (key: K) => string; set: (changes: Partial<Record<K, string>>) => void },
  keys: readonly K[]
) {
  const [changes, setChanges] = useState<Partial<Record<K, string>>>({});

  const get = (key: K) => changes[key] ?? url.get(key);
  const set = (next: Partial<Record<K, string>>) => setChanges((current) => ({ ...current, ...next }));
  const discard = () => setChanges({});

  /** Writes what differs from the URL. Nothing different: no write, so the list stays on its page. */
  const write = (values: Partial<Record<K, string>>) => {
    const different = (Object.entries(values) as [K, string][]).filter(([key, value]) => value !== url.get(key));
    if (different.length > 0) url.set(Object.fromEntries(different) as Partial<Record<K, string>>);
  };

  return {
    get,
    set,
    discard,
    apply: () => write(changes),
    /** Clears every filter in the modal; anything else in the URL (the search) stays. The modal keeps showing what it had while it fades out. */
    reset: () => {
      setChanges(Object.fromEntries(keys.map((key) => [key, get(key)])) as Partial<Record<K, string>>);
      write(Object.fromEntries(keys.map((key) => [key, ""])) as Partial<Record<K, string>>);
    },
  };
}
