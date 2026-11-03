// components/settings/team-section.tsx
// Settings › Team: the people salaries are paid to (they don't sign in),
// newest first, a page at a time. Search by name, role or phone; "Show
// archived" lists the archived ones instead. Add and edit in a dialog;
// archive hides someone from the Salary dropdown.

"use client";

import { useCallback } from "react";
import { Users } from "lucide-react";
import { formFields } from "@/components/forms/fields";
import { FilterSearch, FilterToolbar } from "@/components/shared/filter-toolbar";
import { CardHeader, CardLine, CardMeta, LedgerTableFrame } from "@/components/shared/ledger-table-frame";
import { NoMatches, NothingYet } from "@/components/shared/list-empty-states";
import { NewRecordButton } from "@/components/shared/new-record-button";
import type { PageLinks } from "@/components/shared/pagination";
import { RecordList } from "@/components/shared/record-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { TitledSection } from "@/components/shared/titled-section";
import { useRecordDialog } from "@/hooks/use-record-dialog";
import { useUrlFilters } from "@/hooks/use-url-filters";
import type { PageInfo } from "@/lib/domain/filters";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import type { TeamFilters } from "@/lib/domain/settings-filters";
import { SHORTCUTS } from "@/lib/domain/shortcuts";
import type { TeamMember } from "@/lib/domain/team";
import { teamMemberDraftSchema } from "@/lib/domain/team.schema";
import { namedColumns } from "./named-columns";
import { NamedRowMenu } from "./named-row-menu";
import { RecordDialog } from "./record-dialog";

type TeamValues = { name: string; role: string; phone: string };
const { TextField } = formFields<TeamValues>();

const ARCHIVE_DESCRIPTION =
  "They'll no longer be offered for salaries. Salaries already paid to them keep their name, and you can restore them any time.";

const FILTER_KEYS = ["teamSearch", "teamArchived"] as const;

/**
 * `team` is the page shown (`empty`: no team members at all) for `filters`;
 * `links` keep the rest of Settings' state in the pager's URLs, and
 * `resetHref` is Settings without the team's filters.
 */
export function TeamSection({
  team,
  filters,
  links,
  resetHref,
}: {
  team: { items: TeamMember[]; empty: boolean } & PageInfo;
  filters: TeamFilters;
  links: PageLinks;
  resetHref: string;
}) {
  const { record: member, openNew, openEdit, dialog } = useRecordDialog<TeamMember>({ shortcut: SHORTCUTS.addTeamMember, api: routes.api.team });
  const { get, set, clear, hasAny, isPending, archived } = useUrlFilters(FILTER_KEYS, { pageParam: links.pageParam, archivedParam: "teamArchived" });
  const onSearch = useCallback((teamSearch: string) => set({ teamSearch }), [set]);
  const menu = (m: TeamMember) => (
    <NamedRowMenu record={m} url={routes.api.team.one(m.id)} what="team member" archiveDescription={ARCHIVE_DESCRIPTION} onEdit={() => openEdit(m)} />
  );

  return (
    <TitledSection
      id="team"
      title="Team"
      description="The people you pay. Salaries are recorded against them. They don't sign in to the app."
      action={<NewRecordButton label="Add team member" shortcut={SHORTCUTS.addTeamMember} onClick={openNew} />}
    >
      <RecordList
        empty={
          team.empty && (
            <NothingYet
              icon={Users}
              title="No team members yet"
              description="Add the people you pay, so salary expenses can name who was paid."
              newLabel="Add team member"
              onNew={openNew}
            />
          )
        }
        filters={
          <FilterToolbar
            archived={archived}
            onToggleArchived={() => set({ teamArchived: archived ? "" : "1" })}
            onReset={hasAny ? clear : undefined}
            search={<FilterSearch value={get("teamSearch")} onSearch={onSearch} pending={isPending} placeholder="Search name, role, phone…" label="Search team" />}
          />
        }
        noMatches={
          filters.q || filters.archived ? (
            <NoMatches plural="team members" listHref={resetHref} archivedOnly={filters.archived && !filters.q} filtered />
          ) : (
            <NothingYet
              icon={Users}
              title="No active team members"
              description="Everyone is archived. Add someone, or restore them from Show archived."
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
        description="Name is required; role and phone are optional."
        schema={teamMemberDraftSchema}
        defaultValues={{ name: member?.name ?? "", role: member?.role ?? "", phone: member?.phone ?? "" }}
        saved={member ? "Team member saved" : "Team member added"}
      >
        <TextField name="name" label="Name" autoComplete="off" maxLength={80} autoFocus required />
        <TextField name="role" label="Role" placeholder="e.g. Guide, Sales" autoComplete="off" maxLength={50} />
        <TextField name="phone" label="Phone" type="tel" inputMode="tel" autoComplete="off" maxLength={15} />
      </RecordDialog>
    </TitledSection>
  );
}
