// lib/server/team/service.ts
// Team members (the people salaries are paid to). Pages and route handlers
// call these functions — never the repository directly. Every function
// verifies the session itself.

import "server-only";

import type { PageInfo } from "@/lib/domain/filters";
import { isArchived } from "@/lib/domain/records";
import { nameKeyOf, type NamedOption } from "@/lib/domain/named-records";
import type { TeamFilters } from "@/lib/domain/settings-filters";
import { SALES_ROLE, type TeamMember } from "@/lib/domain/team";
import { teamMemberDraftSchema, teamMemberIdSchema, updateTeamMemberSchema } from "@/lib/domain/team.schema";
import { generalRepo } from "../db/general-repo";
import { roleScope, teamRepo } from "../db/team-repo";
import { ValidationError } from "../errors";
import { verifySession } from "../guards";
import { namedService } from "../records/named-service";
import { validate } from "../records/rules";

/** A new role must be an active item of the Roles list, and takes its spelling. */
async function roleFromList(role: string): Promise<string> {
  const match = (await generalRepo.options({ kind: "role" })).find((item) => nameKeyOf(item.name) === nameKeyOf(role));
  if (!match) throw new ValidationError({ role: "Pick a role from the list (add new ones in Settings)." });
  return match.name;
}

const team = namedService<TeamMember>({
  record: "team member",
  repo: teamRepo,
  idSchema: teamMemberIdSchema,
  draftOf: async (input) => {
    const draft = validate(teamMemberDraftSchema, input);
    return { ...draft, role: await roleFromList(draft.role) };
  },
  edited: async (current, input) => {
    const changes = validate(updateTeamMemberSchema, input);
    const draft = validate(teamMemberDraftSchema, { name: current.name, role: current.role, phone: current.phone, ...changes });
    // An unchanged role stays as saved, even if no longer in the list
    return { ...current, ...draft, role: nameKeyOf(draft.role) === nameKeyOf(current.role) ? current.role : await roleFromList(draft.role) };
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

/** Everyone, or only one role's members, for the API: active first, then newest first. */
export async function getTeamList({ role }: { role?: string } = {}): Promise<TeamMember[]> {
  await verifySession();
  return teamRepo.list(role ? roleScope(role) : {});
}

/**
 * One page of the team for Settings (NAMED_PAGE_SIZE a page), newest first:
 * the active members, or the archived ones, matching the search and role.
 * `empty`: there are no team members at all.
 */
export async function getTeamPage(page: number, { q, role, archived }: TeamFilters): Promise<{ items: TeamMember[]; empty: boolean } & PageInfo> {
  await verifySession();
  const result = await teamRepo.page(page, { archived, q, scope: role ? roleScope(role) : undefined });
  return { ...result, empty: result.total === 0 && !(await teamRepo.exists()) };
}

/** The Salary dropdown: active team members by name, with their role. */
export async function getTeamOptions(): Promise<NamedOption[]> {
  await verifySession();
  return teamRepo.options();
}

/** Lead closed by's dropdown: active Sales team members by name. */
export async function getSalesOptions(): Promise<NamedOption[]> {
  await verifySession();
  return teamRepo.options(roleScope(SALES_ROLE));
}

/** The Bookings filter's Lead closed by choices, like getTeamFilterOptions but Sales only. */
export async function getSalesFilterOptions(): Promise<Record<string, string>> {
  await verifySession();
  return filterChoices(await teamRepo.list(roleScope(SALES_ROLE)));
}

/**
 * A list filter's team choices (value → label): everyone, active first and
 * then archived (marked), each by name, so older records can still be found.
 */
export async function getTeamFilterOptions(): Promise<Record<string, string>> {
  await verifySession();
  return filterChoices(await teamRepo.list());
}

/**
 * The team filter's Role choices (name → label): the Roles list and any older
 * role someone still has, by name, then the archived ones (marked).
 */
export async function getRoleFilterOptions(): Promise<Record<string, string>> {
  await verifySession();
  const [members, listed] = await Promise.all([teamRepo.list(), generalRepo.list({ kind: "role" })]);
  const byName = (names: string[]) => names.toSorted((x, y) => nameKeyOf(x).localeCompare(nameKeyOf(y)));
  const listedKeys = new Set(listed.map((item) => nameKeyOf(item.name)));
  const older = new Map(members.filter((m) => m.role && !listedKeys.has(nameKeyOf(m.role))).map((m) => [nameKeyOf(m.role), m.role]));
  const names = (archived: boolean) => listed.filter((item) => isArchived(item) === archived).map((item) => item.name);
  return Object.fromEntries([
    ...byName([...names(false), ...older.values()]).map((name) => [name, name]),
    ...byName(names(true)).map((name) => [name, `${name} · Archived`]),
  ]);
}

function filterChoices(members: TeamMember[]): Record<string, string> {
  const everyone = members.toSorted((x, y) => Number(isArchived(x)) - Number(isArchived(y)) || nameKeyOf(x.name).localeCompare(nameKeyOf(y.name)));
  return Object.fromEntries(everyone.map((m) => [m.id, isArchived(m) ? `${m.name} · Archived` : m.name]));
}
