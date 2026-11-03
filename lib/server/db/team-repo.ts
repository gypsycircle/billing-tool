// lib/server/db/team-repo.ts
// Persistence for team members (the `users` collection), on the shared named-record repository.

import "server-only";

import { DuplicateNameError } from "../errors";
import { usersCollection } from "./collections";
import { fromTeamMemberDoc, toTeamMemberDoc } from "./mapping";
import { namedRepo } from "./named-repo";

export const teamRepo = namedRepo({
  collection: usersCollection,
  toDoc: toTeamMemberDoc,
  fromDoc: fromTeamMemberDoc,
  // Newest first; searched by name, role or phone
  order: { createdAt: -1, _id: 1 },
  searchFields: ["name", "role", "phone"],
  // The Salary dropdown shows each person's role under their name
  optionDetail: { fields: ["role"], of: (doc) => doc.role || undefined },
  duplicateName: (member) => new DuplicateNameError("team member", member.name),
});
