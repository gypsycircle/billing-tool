// hooks/use-api-mutation.ts
// Runs a write request with a pending state and a double-submit lock.
// Failures are returned (for field errors) and, by default, shown as a toast.

"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, type ApiResult } from "@/lib/client/api-client";

interface MutateOptions {
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Show the error message as a toast (default true). */
  toastOnError?: boolean;
}

export function useApiMutation<T>() {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const mutate = useCallback(
    async (url: string, { method, body, headers, toastOnError = true }: MutateOptions): Promise<ApiResult<T> | null> => {
      if (inFlight.current) return null; // ignore double clicks
      inFlight.current = true;
      setPending(true);
      try {
        const result = await apiFetch<T>(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (result.error && result.status !== 401 && toastOnError) toast.error(result.error);
        return result;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    []
  );

  return { mutate, pending };
}
