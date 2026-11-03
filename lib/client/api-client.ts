// lib/client/api-client.ts
// Browser fetch helpers for our own API (JSON, and files such as the bill).
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
function redirectToSignIn(): void {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  toast.error("Your session has expired. Please sign in again.");
  setTimeout(() => window.location.replace(`/?next=${next}`), 1000);
}

const NETWORK_ERROR = "Network error. Please check your connection and try again.";

/** The error message an error response carries, or a generic one with its status. */
const errorOf = (body: { error?: unknown } | null, status: number) =>
  typeof body?.error === "string" ? body.error : `Request failed (${status}).`;

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
        error: errorOf(body, response.status),
        fieldErrors: body?.fieldErrors && typeof body.fieldErrors === "object" ? body.fieldErrors : {},
        status: response.status,
      };
    }

    return { data: body as T, error: null, fieldErrors: {}, status: response.status };
  } catch {
    return {
      data: null,
      error: NETWORK_ERROR,
      fieldErrors: {},
      status: null,
    };
  }
}

/** A file from the API (the bill) with its name (Content-Disposition), or the error, as apiFetch reports them. */
export async function apiFetchFile(url: string): Promise<{ blob: Blob; fileName: string | null } | { error: string; status: number | null }> {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (response.status === 401) {
      redirectToSignIn();
      return { error: "Session expired.", status: 401 };
    }
    if (!response.ok) return { error: errorOf(await response.json().catch(() => null), response.status), status: response.status };
    const fileName = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? null;
    return { blob: await response.blob(), fileName };
  } catch {
    return { error: NETWORK_ERROR, status: null };
  }
}
