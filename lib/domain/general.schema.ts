// lib/domain/general.schema.ts
// Zod schemas for list items, shared by the Settings form, the API and the
// service. A name's length limit depends on its list (a route can be longer
// than a destination), matching the booking fields they fill.

import { z } from "zod";
import { recordIdSchema, text } from "./field-rules";
import { oneOf } from "./filters";
import { GENERAL_KIND_IDS, GENERAL_KINDS, type GeneralItemDraft, type GeneralKind } from "./general";

export const generalItemIdSchema = recordIdSchema("list item");

export const generalKindSchema = z.enum(GENERAL_KIND_IDS, { error: "Choose a list." });

/** The name rule for one list: required, up to that list's length. */
export const generalNameSchema = (kind: GeneralKind) => text("Name", GENERAL_KINDS[kind].max);

/** Create: the list and the name. */
export const generalItemDraftSchema = z
  .object({ kind: generalKindSchema, name: z.string() })
  .transform((data, ctx): GeneralItemDraft => {
    const name = generalNameSchema(data.kind).safeParse(data.name);
    if (name.success) return { kind: data.kind, name: name.data };
    ctx.addIssue({ code: "custom", path: ["name"], message: name.error.issues[0].message });
    return z.NEVER;
  });

/** Update: only the name can change (an item never moves to another list). */
export const updateGeneralItemSchema = z.object({ name: z.string() }).strict();

/** Which list a query asks for (?kind= on the API, ?list= in Settings): undefined when missing or unknown. */
export const listKindParam = (value: string | string[] | undefined): GeneralKind | undefined => oneOf(GENERAL_KIND_IDS).parse(value);

/** GET /api/general's query. */
export const parseGeneralListQuery = (query: Record<string, string | string[] | undefined>) => ({ kind: listKindParam(query.kind) });
