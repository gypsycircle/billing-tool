// hooks/use-record-actions.ts
// Archive and restore for one record (booking, expense, team member, list
// item), plus `run` for a record's own status changes (a booking's cancel /
// reactivate). Each sends the version on screen (X-Record-Version), so it
// can't overwrite a newer save; if someone else changed the record first, the
// page refreshes to show it.

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RECORD_VERSION_HEADER, restoreHint } from "@/lib/domain/records";
import { useApiMutation } from "./use-api-mutation";

type Change = { method: "PATCH"; body: unknown } | { method: "DELETE" };

interface RecordActionsOptions {
  /** The record's API path (routes.api.…one(id)). */
  url: string;
  /** Its updatedAt on screen. */
  version: string;
  /** How the toasts name it: "Booking No. INV_…", "Ravi Kumar". */
  title: string;
  /** The PATCH body that restores it (default { status: "Active" }). */
  restoreBody?: unknown;
  /** From a list: its name ("bookings", "team members"), so the archive toast can say how to find the record again. */
  findArchived?: string;
}

export function useRecordActions({ url, version, title, restoreBody = { status: "Active" }, findArchived }: RecordActionsOptions) {
  const router = useRouter();
  const { mutate, pending } = useApiMutation<unknown>();

  /** Sends one change; on success toasts and refreshes (a record's page then shows it changed, e.g. archived). */
  const run = useCallback(
    async (change: Change, success: string) => {
      const result = await mutate(url, { ...change, headers: { [RECORD_VERSION_HEADER]: version } });
      if (result?.status === 412) router.refresh(); // show the newer version
      if (!result?.data) return false;
      toast.success(success);
      router.refresh();
      return true;
    },
    [mutate, router, url, version]
  );

  return {
    pending,
    run,
    restore: () => run({ method: "PATCH", body: restoreBody }, `${title} restored.`),
    /** Archive. The page stays where it is: a list drops the row, a record's page shows it archived with Restore. */
    archive: () => run({ method: "DELETE" }, `${title} archived.${findArchived ? ` ${restoreHint(findArchived)}` : ""}`),
  };
}

export type RecordActions = ReturnType<typeof useRecordActions>;
