// lib/server/general/service.ts
// The general lists (destinations, packages, routes, marketing channels).
// Pages and route handlers call these functions — never the repository
// directly. Every function verifies the session itself.

import "server-only";

import { z } from "zod";
import type { PageInfo } from "@/lib/domain/filters";
import { GENERAL_KIND_IDS, type GeneralItem, type GeneralKind } from "@/lib/domain/general";
import { generalItemDraftSchema, generalItemIdSchema, generalNameSchema, updateGeneralItemSchema } from "@/lib/domain/general.schema";
import type { NamedOption } from "@/lib/domain/named-records";
import { generalRepo } from "../db/general-repo";
import { ValidationError } from "../errors";
import { verifySession } from "../guards";
import { namedService } from "../records/named-service";
import { validate } from "../records/rules";

const general = namedService<GeneralItem>({
  record: "list item",
  repo: generalRepo,
  idSchema: generalItemIdSchema,
  draftOf: (input) => validate(generalItemDraftSchema, input),
  // Only the name changes; it must still fit its list
  edited: (current, input) => {
    const { name } = validate(updateGeneralItemSchema, input);
    return { ...current, ...validate(z.object({ name: generalNameSchema(current.kind) }), { name }) };
  },
});

export const {
  get: getGeneralItem,
  create: createGeneralItem,
  update: updateGeneralItem,
  change: changeGeneralItem,
  setStatus: setGeneralItemStatus,
  archive: archiveGeneralItem,
} = general;

/** One whole list (the API): active first, then by name. A query without a known list is refused (422). */
export async function getGeneralList({ kind }: { kind: GeneralKind | undefined }): Promise<GeneralItem[]> {
  await verifySession();
  if (!kind) throw new ValidationError({ kind: "Choose a list." });
  return generalRepo.list({ kind });
}

/** One page of a list for Settings (NAMED_PAGE_SIZE a page), by name: its active items, or its archived ones (`empty`: the list has no items at all). */
export async function getGeneralListPage(kind: GeneralKind, page: number, { archived }: { archived: boolean }): Promise<{ items: GeneralItem[]; empty: boolean } & PageInfo> {
  await verifySession();
  const result = await generalRepo.page(page, { scope: { kind }, archived });
  return { ...result, empty: result.total === 0 && !(await generalRepo.exists({ kind })) };
}

/** How many active items each list has (shown beside its name in Settings). */
export async function getGeneralActiveCounts(): Promise<Record<GeneralKind, number>> {
  await verifySession();
  const counts = await Promise.all(GENERAL_KIND_IDS.map((kind) => generalRepo.activeCount({ kind })));
  return Object.fromEntries(GENERAL_KIND_IDS.map((kind, i) => [kind, counts[i]])) as Record<GeneralKind, number>;
}

/** One list's dropdown: its active items by name. */
export async function getGeneralOptions(kind: GeneralKind): Promise<NamedOption[]> {
  await verifySession();
  return generalRepo.options({ kind });
}

/**
 * The exact name of the active item matching each value (any case or
 * spacing), or undefined where a list has none. For services that already
 * verified the session (bookings check their destination, package and route).
 */
export async function activeListNames(values: Partial<Record<GeneralKind, string>>): Promise<Partial<Record<GeneralKind, string>>> {
  const wanted = (Object.entries(values) as [GeneralKind, string][]).filter(([, name]) => name);
  const found = await Promise.all(wanted.map(([kind, name]) => generalRepo.findActiveByName(name, { kind })));
  return Object.fromEntries(wanted.flatMap(([kind], i) => (found[i] ? [[kind, found[i].name]] : [])));
}
