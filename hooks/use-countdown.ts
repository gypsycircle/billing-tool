// hooks/use-countdown.ts
// A seconds countdown, e.g. for a login lockout.
//   const { secondsLeft, start } = useCountdown();
//   start(900); // from an event handler

"use client";

import { useCallback, useEffect, useState } from "react";

interface CountdownState {
  endsAt: number;
  now: number;
}

export function useCountdown(): { secondsLeft: number; start: (seconds: number) => void } {
  const [state, setState] = useState<CountdownState | null>(null);

  const start = useCallback((seconds: number) => {
    const now = Date.now();
    setState({ endsAt: now + seconds * 1000, now });
  }, []);

  const endsAt = state?.endsAt ?? null;
  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setState({ endsAt, now });
      if (now >= endsAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  const secondsLeft = state ? Math.max(0, Math.ceil((state.endsAt - state.now) / 1000)) : 0;
  return { secondsLeft, start };
}

/** Formats seconds as m:ss, e.g. 754 → "12:34". */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
