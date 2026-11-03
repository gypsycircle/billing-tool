// lib/domain/routes.ts
// Every page and API path the app links to or calls, built in one place.

import type { GeneralKind } from "./general";

const record = (base: string) => ({
  list: base,
  new: `${base}/new`,
  page: (id: string) => `${base}/${id}`,
  edit: (id: string) => `${base}/${id}/edit`,
});

const api = (base: string) => ({ list: base, one: (id: string) => `${base}/${id}` });

export const routes = {
  /** The access page (sign in). */
  access: "/",
  bookings: record("/bookings"),
  expenses: record("/expenses"),
  settings: {
    page: "/settings",
    team: "/settings#team",
    list: (kind: GeneralKind) => `/settings?list=${kind}#lists`,
  },
  api: {
    auth: { login: "/api/auth/login", logout: "/api/auth/logout" },
    bookings: api("/api/bookings"),
    bill: (id: string) => `/api/bookings/${id}/pdf`,
    historyBill: (id: string, entryId: string) => `/api/bookings/${id}/history/${entryId}/pdf`,
    expenses: api("/api/expenses"),
    team: api("/api/team"),
    general: api("/api/general"),
  },
} as const;
