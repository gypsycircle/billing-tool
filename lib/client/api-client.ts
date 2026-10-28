// lib/client/api-client.ts
// Browser fetch helper for our own JSON API.
// - same-origin credentials, JSON headers
// - 401 (session expired) → toast + redirect to /?next=<current path>
// - errors come back as { error, fieldErrors } instead of throwing
//
//   const { data, error, fieldErrors } = await apiFetch<{ booking: Booking }>("/api/bookings", {
//     method: "POST", body: JSON.stringify(values),
//   });

"use client";

import { toast } from "sonner";

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  /** Per-field validation messages from a 422 response. */
  fieldErrors: Record<string, string>;
  status: number | null;
}

/** Session expired (401): say so, then go to sign-in and come back here after. */
export function redirectToSignIn(): void {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  toast.error("Your session has expired. Please sign in again.");
  setTimeout(() => window.location.replace(`/?next=${next}`), 1000);
}

export async function apiFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...options.headers },
    });

    if (response.status === 401) {
      redirectToSignIn();
      return { data: null, error: "Session expired.", fieldErrors: {}, status: 401 };
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: typeof body?.error === "string" ? body.error : `Request failed (${response.status}).`,
        fieldErrors: body?.fieldErrors && typeof body.fieldErrors === "object" ? body.fieldErrors : {},
        status: response.status,
      };
    }

    return { data: body as T, error: null, fieldErrors: {}, status: response.status };
  } catch {
    return {
      data: null,
      error: "Network error. Please check your connection and try again.",
      fieldErrors: {},
      status: null,
    };
  }
}
