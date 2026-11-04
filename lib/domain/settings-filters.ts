// lib/domain/settings-filters.ts
// The Settings page's URL state, parsed (never trusted). Its two lists each
// keep their own parameters, so filtering or paging one leaves the other where
// it is: the team (?teamSearch=, ?teamRole=, ?teamArchived=1, ?teamPage=) and the chosen
// list (?list=, ?listSearch=, ?listArchived=1, ?listPage=).

import { z } from "zod";
import { flag, oneOf, pageParam, param } from "./filters";
import { GENERAL_KIND_IDS, type GeneralKind } from "./general";
import { routes } from "./routes";

const settingsSchema = z.object({
  teamSearch: param.transform((v) => v.trim().slice(0, 100)),
  teamRole: param.transform((v) => v.trim().slice(0, 50)),
  teamArchived: flag,
  teamPage: pageParam,
  list: oneOf(GENERAL_KIND_IDS).transform((v): GeneralKind => v ?? "destination"),
  listSearch: param.transform((v) => v.trim().slice(0, 100)),
  listArchived: flag,
  listPage: pageParam,
});

export type SettingsFilters = z.infer<typeof settingsSchema>;

/** The team's filters (search, role, archived view) as the service takes them. */
export type TeamFilters = { q: string; role: string; archived: boolean };

/** Reads Settings' state from Next.js searchParams; an unknown list opens Destinations. */
export function parseSettingsFilters(params: Record<string, string | string[] | undefined>): SettingsFilters {
  return settingsSchema.parse(params);
}

/** Every set parameter (for links): page 1, Destinations and off are left out. */
export function settingsParams(s: SettingsFilters): Record<string, string> {
  const pageOf = (page: number) => (page > 1 ? String(page) : "");
  return {
    teamSearch: s.teamSearch,
    teamRole: s.teamRole,
    teamArchived: s.teamArchived ? "1" : "",
    teamPage: pageOf(s.teamPage),
    list: s.list === "destination" ? "" : s.list,
    listSearch: s.listSearch,
    listArchived: s.listArchived ? "1" : "",
    listPage: pageOf(s.listPage),
  };
}

/** The Settings URL for this state, landing on a section ("team", "lists"). */
export function settingsHref(s: SettingsFilters, anchor: string): string {
  const query = new URLSearchParams(Object.entries(settingsParams(s)).filter(([, value]) => value !== "")).toString();
  return `${routes.settings.page}${query ? `?${query}` : ""}#${anchor}`;
}
