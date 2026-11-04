// components/settings/team-section.tsx
// Settings › Team: the people salaries are paid to (they don't sign in),
// newest first, a page at a time. Search by name, role or phone; Filters holds
// the role and the archived view, which lists the archived ones instead. Add
// and edit in a dialog; archive hides someone from the Salary dropdown.

"use client";

import { bookingListChoices } from "@/lib/domain/general";
import { useCallback } from "react";
import { Users } from "lucide-react";
import { formFields } from "@/components/forms/fields";
import { FilterDialog } from "@/components/shared/filter-dialog";
import { FilterArchived, FilterSearch, FilterSelect } from "@/components/shared/filter-toolbar";
import { CardHeader, CardLine, CardMeta, LedgerTableFrame } from "@/components/shared/ledger-table-frame";
import { NoMatches, NothingYet } from "@/components/shared/list-empty-states";
import { NewRecordButton } from "@/components/shared/new-record-button";
import type { PageLinks } from "@/components/shared/pagination";
import { RecordList } from "@/components/shared/record-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { TitledSection } from "@/components/shared/titled-section";
import { useRecordDialog } from "@/hooks/use-record-dialog";
import { useFilterDraft } from "@/hooks/use-filter-draft";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { appliedFilterCount, type PageInfo } from "@/lib/domain/filters";
import { isArchived, showArchivedLabel } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import type { TeamFilters } from "@/lib/domain/settings-filters";
import { SHORTCUTS } from "@/lib/domain/shortcuts";
import type { TeamMember } from "@/lib/domain/team";
import { teamMemberDraftSchema } from "@/lib/domain/team.schema";
import { namedColumns } from "./named-columns";
import { NamedRowMenu } from "./named-row-menu";
import { RecordDialog } from "./record-dialog";

type TeamValues = { name: string; role: string; phone: string };
const { SelectField, TextField } = formFields<TeamValues>();

const ARCHIVE_DESCRIPTION = "They won't be offered for salaries or Lead closed by.";

const DIALOG_KEYS = ["teamRole", "teamArchived"] as const;
const FILTER_KEYS = ["teamSearch", ...DIALOG_KEYS] as const;

/**
 * `team` is the page shown (`empty`: no team members at all) for `filters`;
 * `links` keep the rest of Settings' state in the pager's URLs, and
 * `resetHref` is Settings without the team's filters.
 */
export function TeamSection({
  team,
  roles,
  roleFilter,
  filters,
  links,
  resetHref,
}: {
  team: { items: TeamMember[]; empty: boolean } & PageInfo;
  /** The Roles list's active names, for the form's dropdown. */
  roles: readonly string[];
  /** The Role filter's choices (getRoleFilterOptions). */
  roleFilter: Readonly<Record<string, string>>;
  filters: TeamFilters;
  links: PageLinks;
  resetHref: string;
}) {
  const { record: member, openNew, openEdit, dialog } = useRecordDialog<TeamMember>({ shortcut: SHORTCUTS.addTeamMember, api: routes.api.team });
  const url = useUrlFilters(FILTER_KEYS, { pageParam: links.pageParam, archivedParam: "teamArchived" });
  const { get, set, discard, apply, reset } = useFilterDraft(url, DIALOG_KEYS);
  const { set: setUrl } = url;
  const onSearch = useCallback((teamSearch: string) => setUrl({ teamSearch }), [setUrl]);
  const menu = (m: TeamMember) => (
    <NamedRowMenu record={m} url={routes.api.team.one(m.id)} what="team member" things="team members" archiveDescription={ARCHIVE_DESCRIPTION} onEdit={() => openEdit(m)} />
  );

  return (
    <TitledSection
      id="team"
      title="Team"
      description="The people you pay, and who close bookings. Salaries are recorded against them. They don't sign in to the app."
      action={<NewRecordButton label="Add team member" shortcut={SHORTCUTS.addTeamMember} onClick={openNew} />}
    >
      <RecordList
        empty={
          team.empty && (
            <NothingYet
              icon={Users}
              title="No team members yet"
              description="Add the people you pay, so salary expenses can name who was paid, and your Sales team, so bookings can say who closed them."
              newLabel="Add team member"
              onNew={openNew}
            />
          )
        }
        filters={
          <FilterDialog
            search={<FilterSearch value={url.get("teamSearch")} onSearch={onSearch} pending={url.isPending} placeholder="Search name, role, phone…" label="Search team" />}
            count={appliedFilterCount({ role: filters.role, archived: filters.archived ? "1" : "" })}
            pending={url.isPending}
            onApply={apply}
            onReset={reset}
            onDiscard={discard}
          >
            <FilterSelect label="Role" allLabel="All roles" options={roleFilter} value={get("teamRole")} onChange={(teamRole) => set({ teamRole })} />
            <FilterArchived label={showArchivedLabel("team members")} checked={get("teamArchived") === "1"} onChange={(on) => set({ teamArchived: on ? "1" : "" })} />
          </FilterDialog>
        }
        noMatches={
          filters.q || filters.role || filters.archived ? (
            <NoMatches plural="team members" listHref={resetHref} archivedOnly={filters.archived && !filters.q && !filters.role} filtered />
          ) : (
            <NothingYet
              icon={Users}
              title="No active team members"
              description="Everyone is archived. Add someone, or find them to restore under Filters."
              newLabel="Add team member"
              onNew={openNew}
            />
          )
        }
        page={team}
        links={links}
        label="Team pages"
        table={
          <LedgerTableFrame
            rows={team.items}
            rowKey={(m) => m.id}
            columns={namedColumns(menu, {
              between: [
                { header: "Role", cell: (m) => m.role || "—" },
                { header: "Phone", className: "tabular", cell: (m) => m.phone || "—" },
              ],
            })}
            muted={isArchived}
            card={(m) => (
              <>
                <CardHeader title={m.name} lines={<CardLine>{m.role || "No role"}</CardLine>} menu={menu(m)} />
                <CardMeta items={[{ label: "Phone", value: m.phone || "—" }, { label: "Status", value: <StatusBadge value={m.status} /> }]} />
              </>
            )}
          />
        }
      />

      <RecordDialog<TeamValues>
        {...dialog}
        title={member ? `Edit ${member.name}` : "Add team member"}
        description="Name and role are required; phone is optional."
        schema={teamMemberDraftSchema}
        defaultValues={{ name: member?.name ?? "", role: member?.role ?? "", phone: member?.phone ?? "" }}
        saved={member ? "Team member saved." : "Team member added."}
      >
        <TextField name="name" label="Name" autoComplete="off" maxLength={80} autoFocus required />
        <SelectField name="role" label="Role" options={bookingListChoices(roles, member?.role)} placeholder="Choose a role" hint="Add roles in Settings, under Lists." required />
        <TextField name="phone" label="Phone" type="tel" inputMode="tel" autoComplete="off" maxLength={15} />
      </RecordDialog>
    </TitledSection>
  );
}
