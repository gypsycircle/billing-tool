// hooks/use-api-mutation.ts
// Runs a write request once at a time (useSingleFlight) with a pending state.
// Failures are returned (for field errors) and, by default, shown as a toast.

"use client";

import { toast } from "sonner";
import { apiFetch, type ApiResult } from "@/lib/client/api-client";
import { useSingleFlight } from "./use-single-flight";

interface MutateOptions {
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Show the error message as a toast (default true). */
  toastOnError?: boolean;
}

export function useApiMutation<T>() {
  const { run, pending } = useSingleFlight(async (url: string, { method, body, headers, toastOnError = true }: MutateOptions): Promise<ApiResult<T>> => {
    const result = await apiFetch<T>(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (result.error && result.status !== 401 && toastOnError) toast.error(result.error);
    return result;
  });
  return { mutate: run, pending };
}
