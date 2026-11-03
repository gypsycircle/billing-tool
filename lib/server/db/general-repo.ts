// lib/server/db/general-repo.ts
// Persistence for list items (the `general` collection), on the shared
// named-record repository. Every read is scoped to one list: { kind }.

import "server-only";

import { GENERAL_KINDS } from "@/lib/domain/general";
import { DuplicateNameError } from "../errors";
import { generalCollection } from "./collections";
import { fromGeneralItemDoc, toGeneralItemDoc } from "./mapping";
import { namedRepo } from "./named-repo";

export const generalRepo = namedRepo({
  collection: generalCollection,
  toDoc: toGeneralItemDoc,
  fromDoc: fromGeneralItemDoc,
  // By name, like the dropdowns
  order: { nameKey: 1 },
  duplicateName: (item) => new DuplicateNameError(GENERAL_KINDS[item.kind].one, item.name),
});
