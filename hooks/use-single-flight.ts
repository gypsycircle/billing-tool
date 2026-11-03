// hooks/use-single-flight.ts
// Runs an async action once at a time: a second call while the first is
// running is ignored (double clicks), and `pending` says it is running.
// `holdOnSuccess` keeps it pending after it succeeds (e.g. while the page
// navigates away after logging out).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSingleFlight<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
  { holdOnSuccess }: { holdOnSuccess?: (result: Result) => boolean } = {}
) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const latest = useRef({ action, holdOnSuccess });
  useEffect(() => {
    latest.current = { action, holdOnSuccess };
  });

  const run = useCallback(async (...args: Args): Promise<Result | null> => {
    if (inFlight.current) return null; // already running: ignore
    inFlight.current = true;
    setPending(true);
    let hold = false;
    try {
      const result = await latest.current.action(...args);
      hold = latest.current.holdOnSuccess?.(result) ?? false;
      return result;
    } finally {
      if (!hold) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }, []);

  return { run, pending };
}
