// hooks/use-server-field-errors.ts
// A refused save (422) names the fields at fault: show each message on its
// field and focus the first. A stale save (412) gets a lasting toast with
// Reload, never an overwrite. Anything else is a toast.

"use client";

import { useCallback } from "react";
import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

export function useServerFieldErrors<T extends FieldValues>(setError: UseFormSetError<T>, fields: readonly string[]) {
  return useCallback(
    (status: number | null, error: string | null, fieldErrors: Record<string, string>) => {
      let mapped = false;
      for (const [field, message] of Object.entries(fieldErrors)) {
        if (fields.includes(field)) {
          setError(field as FieldPath<T>, { type: "server", message }, { shouldFocus: !mapped });
          mapped = true;
        }
      }
      if (status === 412 && error) {
        // Someone else saved this record after it was opened: never overwrite it
        toast.error(error, {
          duration: Infinity,
          action: { label: "Reload", onClick: () => window.location.reload() },
        });
        return;
      }
      if (!mapped && error) toast.error(error);
    },
    [setError, fields]
  );
}
