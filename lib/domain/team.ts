// lib/domain/team.ts
// The team: the people the business pays (salaries are paid to them). They
// don't sign in; the app keeps one shared access code.

import type { NamedRecord } from "./named-records";

export interface TeamMember extends NamedRecord {
  /** e.g. "Guide", "Sales"; "" when not given. */
  role: string;
  /** "" when not given. */
  phone: string;
}

/** What the user enters. */
export type TeamMemberDraft = Pick<TeamMember, "name" | "role" | "phone">;
