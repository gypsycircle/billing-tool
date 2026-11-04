// lib/domain/team.ts
// The team: the people the business pays (salaries are paid to them). They
// don't sign in; the app keeps one shared access code.

import { nameKeyOf, type NamedRecord } from "./named-records";

/** The role that takes sales: only they can be a booking's Lead closed by. */
export const SALES_ROLE = "Sales";

export interface TeamMember extends NamedRecord {
  /** A name from the Roles list, as it was when saved; "" when not given. */
  role: string;
  /** "" when not given. */
  phone: string;
}

/** What the user enters. */
export type TeamMemberDraft = Pick<TeamMember, "name" | "role" | "phone">;

export const hasRole = (member: Pick<TeamMember, "role">, role: string): boolean => nameKeyOf(member.role) === nameKeyOf(role);
