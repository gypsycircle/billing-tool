// hooks/use-logout.ts
// Shared logout flow for the header button and the command menu. Stays
// pending while the page goes to the access screen.

"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api-client";
import { routes } from "@/lib/domain/routes";
import { useSingleFlight } from "./use-single-flight";

export function useLogout(): { logout: () => Promise<boolean | null>; pending: boolean } {
  const router = useRouter();
  const { run, pending } = useSingleFlight(
    async () => {
      const result = await apiFetch(routes.api.auth.logout, { method: "POST" });
      if (result.error) {
        toast.error("Couldn't log out. Please try again.");
        return false;
      }
      router.replace(routes.access);
      router.refresh();
      return true;
    },
    { holdOnSuccess: (loggedOut) => loggedOut }
  );
  return { logout: run, pending };
}
