// lib/server/team/service.ts
// Team members (the people salaries are paid to). Pages and route handlers
// call these functions — never the repository directly. Every function
// verifies the session itself.

import "server-only";

import type { PageInfo } from "@/lib/domain/filters";
import { isArchived } from "@/lib/domain/records";
import { nameKeyOf, type NamedOption } from "@/lib/domain/named-records";
import type { TeamFilters } from "@/lib/domain/settings-filters";
import type { TeamMember } from "@/lib/domain/team";
import { teamMemberDraftSchema, teamMemberIdSchema, updateTeamMemberSchema } from "@/lib/domain/team.schema";
import { teamRepo } from "../db/team-repo";
import { verifySession } from "../guards";
import { namedService } from "../records/named-service";
import { validate } from "../records/rules";

const team = namedService<TeamMember>({
  record: "team member",
  repo: teamRepo,
  idSchema: teamMemberIdSchema,
  draftOf: (input) => validate(teamMemberDraftSchema, input),
  edited: (current, input) => {
    const changes = validate(updateTeamMemberSchema, input);
    return { ...current, ...validate(teamMemberDraftSchema, { name: current.name, role: current.role, phone: current.phone, ...changes }) };
  },
});

export const {
  get: getTeamMember,
  create: createTeamMember,
  update: updateTeamMember,
  change: changeTeamMember,
  setStatus: setTeamMemberStatus,
  archive: archiveTeamMember,
} = team;

/** Everyone, for the API: active first, then newest first. */
export async function getTeamList(): Promise<TeamMember[]> {
  await verifySession();
  return teamRepo.list();
}

/**
 * One page of the team for Settings (NAMED_PAGE_SIZE a page), newest first:
 * the active members, or the archived ones, matching the search. `empty`:
 * there are no team members at all.
 */
export async function getTeamPage(page: number, { q, archived }: TeamFilters): Promise<{ items: TeamMember[]; empty: boolean } & PageInfo> {
  await verifySession();
  const result = await teamRepo.page(page, { archived, q });
  return { ...result, empty: result.total === 0 && !(await teamRepo.exists()) };
}

/** The Salary dropdown: active team members by name, with their role. */
export async function getTeamOptions(): Promise<NamedOption[]> {
  await verifySession();
  return teamRepo.options();
}

/**
 * A list filter's team choices (value → label): everyone, active first and
 * then archived (marked), each by name, so older records can still be found.
 */
export async function getTeamFilterOptions(): Promise<Record<string, string>> {
  await verifySession();
  const everyone = (await teamRepo.list()).toSorted((x, y) => Number(isArchived(x)) - Number(isArchived(y)) || nameKeyOf(x.name).localeCompare(nameKeyOf(y.name)));
  return Object.fromEntries(everyone.map((m) => [m.id, isArchived(m) ? `${m.name} · Archived` : m.name]));
}
