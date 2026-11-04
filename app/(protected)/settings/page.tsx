// app/(protected)/settings/page.tsx
// Settings: the team (who salaries are paid to) and the lists behind the
// booking and expense forms' dropdowns. Each shows its active records or,
// in its archived view, its archived ones, a page at a time; both can be
// searched, and the team filtered by role. Each section's state is in the URL (parseSettingsFilters) and
// read here on the server; adding, editing and archiving happen in dialogs.

import type { Metadata } from "next";
import { ListsSection } from "@/components/settings/lists-section";
import { TeamSection } from "@/components/settings/team-section";
import { PageBody } from "@/components/shared/page-body";
import { PageHeader } from "@/components/shared/page-header";
import { routes } from "@/lib/domain/routes";
import { parseSettingsFilters, settingsHref, settingsParams } from "@/lib/domain/settings-filters";
import { getGeneralActiveCounts, getGeneralListPage, getGeneralOptions } from "@/lib/server/general/service";
import { getRoleFilterOptions, getTeamPage } from "@/lib/server/team/service";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const filters = parseSettingsFilters(await searchParams);
  const teamFilters = { q: filters.teamSearch, role: filters.teamRole, archived: filters.teamArchived };
  const [team, list, counts, roles, roleFilter] = await Promise.all([
    getTeamPage(filters.teamPage, teamFilters),
    getGeneralListPage(filters.list, filters.listPage, { q: filters.listSearch, archived: filters.listArchived }),
    getGeneralActiveCounts(),
    getGeneralOptions("role"),
    getRoleFilterOptions(),
  ]);

  // The state as shown (pages clamped). Each pager and Reset keeps the other section where it is.
  const shown = { ...filters, teamPage: team.page, listPage: list.page };
  const params = settingsParams(shown);

  return (
    <>
      <PageHeader eyebrow="Settings" title="Team and lists" description="The people you pay, and the choices the booking and expense forms offer." />
      <PageBody>
        <TeamSection
          team={team}
          roles={roles.map((role) => role.name)}
          roleFilter={roleFilter}
          filters={teamFilters}
          links={{ path: routes.settings.page, params: { ...params, teamPage: "" }, pageParam: "teamPage", anchor: "team" }}
          resetHref={settingsHref({ ...shown, teamSearch: "", teamRole: "", teamArchived: false, teamPage: 1 }, "team")}
        />
        <ListsSection
          kind={filters.list}
          list={list}
          counts={counts}
          q={filters.listSearch}
          archived={filters.listArchived}
          links={{ path: routes.settings.page, params: { ...params, listPage: "" }, pageParam: "listPage", anchor: "lists" }}
          resetHref={settingsHref({ ...shown, listSearch: "", listArchived: false, listPage: 1 }, "lists")}
        />
      </PageBody>
    </>
  );
}
