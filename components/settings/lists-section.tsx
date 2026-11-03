// components/settings/lists-section.tsx
// Settings › Lists: the choices the booking and expense forms offer. One list
// at a time, picked from a dropdown and kept in the URL (?list=), by name, a
// page at a time (?listPage=); "Show archived" lists its archived items
// instead (?listArchived=1). Add and rename in a dialog; archive takes an item
// out of its dropdown.

"use client";

import { ListChecks } from "lucide-react";
import { z } from "zod";
import { OptionSelect } from "@/components/shared/option-select";
import { formFields } from "@/components/forms/fields";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { CardHeader, CardMeta, LedgerTableFrame } from "@/components/shared/ledger-table-frame";
import { NoMatches, NothingYet } from "@/components/shared/list-empty-states";
import { NewRecordButton } from "@/components/shared/new-record-button";
import type { PageLinks } from "@/components/shared/pagination";
import { RecordList } from "@/components/shared/record-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { TitledSection } from "@/components/shared/titled-section";
import { useRecordDialog } from "@/hooks/use-record-dialog";
import { useUrlFilters } from "@/hooks/use-url-filters";
import type { PageInfo } from "@/lib/domain/filters";
import { GENERAL_KIND_IDS, GENERAL_KINDS, type GeneralItem, type GeneralKind } from "@/lib/domain/general";
import { generalItemDraftSchema, generalKindSchema, generalNameSchema } from "@/lib/domain/general.schema";
import { isArchived } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import { SHORTCUTS } from "@/lib/domain/shortcuts";
import { cn } from "@/lib/utils";
import { namedColumns } from "./named-columns";
import { NamedRowMenu } from "./named-row-menu";
import { RecordDialog } from "./record-dialog";

type ItemValues = { kind: GeneralKind; name: string };
const { TextField } = formFields<ItemValues>();

/** Where each list's items show up, and what archiving one means. */
const USED_FOR: Record<GeneralKind, { use: string; archive: string; example: string }> = {
  destination: { use: "The booking form's Destination.", archive: "It will no longer be offered for new bookings.", example: "e.g. Goa" },
  package: { use: "The booking form's Package, and Package cost expenses.", archive: "It will no longer be offered for bookings or package costs.", example: "e.g. Goa Beach Camp" },
  route: { use: "The booking form's Route (optional on a booking).", archive: "It will no longer be offered for new bookings.", example: "e.g. Kochi-Munnar-Thekkady" },
  marketing: { use: "Marketing expenses' Channel. \"Other\" (with a description) is always offered too.", archive: "It will no longer be offered for marketing expenses.", example: "e.g. Meta Ads" },
};

const FILTER_KEYS = ["list", "listArchived"] as const;

/** `list` is the page shown of `kind` (its archived items when `archived`; `empty`: none at all); `resetHref` is Settings without the archived view. */
export function ListsSection({
  kind,
  list,
  counts,
  archived,
  links,
  resetHref,
}: {
  kind: GeneralKind;
  list: { items: GeneralItem[]; empty: boolean } & PageInfo;
  counts: Record<GeneralKind, number>;
  archived: boolean;
  links: PageLinks;
  resetHref: string;
}) {
  // Another list, or the archived view, starts at its first page
  const { set, isPending: switching } = useUrlFilters(FILTER_KEYS, { pageParam: links.pageParam, archivedParam: "listArchived" });
  const { record: item, openNew, openEdit, dialog } = useRecordDialog<GeneralItem>({ shortcut: SHORTCUTS.addListItem, api: routes.api.general });
  const { one, title } = GENERAL_KINDS[kind];
  const things = title.toLowerCase();

  /** The dropdown's labels: "Packages · 3". */
  const listChoices = Object.fromEntries(GENERAL_KIND_IDS.map((k) => [k, `${GENERAL_KINDS[k].title} · ${counts[k]}`]));

  const menu = (i: GeneralItem) => (
    <NamedRowMenu
      record={i}
      url={routes.api.general.one(i.id)}
      what={GENERAL_KINDS[i.kind].one}
      archiveDescription={`${USED_FOR[i.kind].archive} It stays on everything already saved with it, and you can restore it any time.`}
      onEdit={() => openEdit(i)}
    />
  );

  return (
    <TitledSection
      id="lists"
      title="Lists"
      description="The choices the booking and expense forms offer. Archived items leave their dropdown but stay on everything already saved."
      action={<NewRecordButton label={`Add ${one}`} shortcut={SHORTCUTS.addListItem} onClick={openNew} />}
    >
      <RecordList
        className={cn("transition-opacity", switching && "opacity-60")}
        filters={
          // Reset leaves the list picked: it only clears the archived view
          <FilterToolbar
            archived={archived}
            onToggleArchived={() => set({ listArchived: archived ? "" : "1" })}
            onReset={archived ? () => set({ listArchived: "" }) : undefined}
          >
            <OptionSelect label="List" options={listChoices} value={kind} onChange={(next) => set({ list: next })} className="w-full sm:w-64" />
            <p className="basis-full text-sm text-muted-foreground sm:flex-1 sm:basis-0 sm:px-2">{USED_FOR[kind].use}</p>
          </FilterToolbar>
        }
        page={list}
        links={links}
        label={`${title} pages`}
        noMatches={
          archived ? (
            <NoMatches plural={things} listHref={resetHref} archivedOnly filtered />
          ) : list.empty ? (
            <NothingYet icon={ListChecks} title={`No ${things} yet`} description={`Add the ${things} the forms should offer.`} newLabel={`Add ${one}`} onNew={openNew} />
          ) : (
            <NothingYet
              icon={ListChecks}
              title={`No active ${things}`}
              description={`They are all archived. Add one, or restore them from Show archived.`}
              newLabel={`Add ${one}`}
              onNew={openNew}
            />
          )
        }
        table={
          <LedgerTableFrame
            rows={list.items}
            rowKey={(i) => i.id}
            columns={namedColumns(menu, { statusClassName: "w-32" })}
            muted={isArchived}
            card={(i) => (
              <>
                <CardHeader title={i.name} menu={menu(i)} />
                <CardMeta items={[{ label: "Status", value: <StatusBadge value={i.status} /> }]} />
              </>
            )}
          />
        }
      />

      <RecordDialog<ItemValues>
        {...dialog}
        title={item ? `Rename ${GENERAL_KINDS[item.kind].one}` : `Add ${one}`}
        description={item ? `Renaming changes it for new ${item.kind === "marketing" ? "expenses" : "bookings and expenses"}; what's already saved keeps the old name.` : `${title}: ${USED_FOR[kind].use}`}
        schema={item ? z.object({ kind: generalKindSchema, name: generalNameSchema(item.kind) }) : generalItemDraftSchema}
        defaultValues={{ kind: item?.kind ?? kind, name: item?.name ?? "" }}
        saved={item ? "Renamed" : `${one[0].toUpperCase()}${one.slice(1)} added`}
      >
        <TextField name="name" label="Name" placeholder={USED_FOR[item?.kind ?? kind].example} autoComplete="off" maxLength={GENERAL_KINDS[item?.kind ?? kind].max} autoFocus required />
      </RecordDialog>
    </TitledSection>
  );
}
