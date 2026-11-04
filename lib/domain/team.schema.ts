// lib/domain/team.schema.ts
// Zod schemas for team members, shared by the Settings form, the API and the service.

import { z } from "zod";
import { optionalPhone, recordIdSchema, text } from "./field-rules";
import { param } from "./filters";
import type { TeamMemberDraft } from "./team";

export const teamMemberIdSchema = recordIdSchema("team member");

const teamMemberObject = z.object({
  name: text("Name", 80),
  role: text("Role", 50),
  phone: optionalPhone("Phone").default(""),
}) satisfies z.ZodType<TeamMemberDraft, unknown>;

/** Create: what the user enters (the phone may be left out). */
export const teamMemberDraftSchema = teamMemberObject;

/** Update: any subset; anything else (the status, the ID) is refused. */
export const updateTeamMemberSchema = z
  .object({ name: text("Name", 80), role: text("Role", 50), phone: optionalPhone("Phone") })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "No changes were provided.");

/** GET /api/team's query: ?role=Sales lists only that role's members. */
export const parseTeamQuery = (query: Record<string, string | string[] | undefined>) => ({ role: param.parse(query.role).trim() });
