// hooks/use-media-query.ts
// Whether a CSS media query matches, following the window as it changes. Only
// for what CSS can't do (a calendar's number of months); before the browser
// has answered, it says yes.

"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
}
