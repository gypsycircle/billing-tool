// hooks/use-logout.ts
// Shared logout flow for the header button and the command menu.

"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useLogout(): { logout: () => Promise<void>; pending: boolean } {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const logout = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);

    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!res.ok) throw new Error(`Logout failed (${res.status})`);
      router.replace("/");
      router.refresh();
      // Stay "pending" while navigating away.
    } catch {
      toast.error("Couldn't log out. Please try again.");
      inFlight.current = false;
      setPending(false);
    }
  }, [router]);

  return { logout, pending };
}
