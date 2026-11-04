// components/settings/lists-section.tsx
// Settings › Lists: the choices the booking and expense forms offer. One list
// at a time, by name, a page at a time (?listPage=). Search looks inside the
// open list (?listSearch=); Filters picks the list (?list=) and holds the
// archived view, which lists its archived items instead (?listArchived=1). Add
// and rename in a dialog; archive takes an item out of its dropdown.

"use client";

import { useCallback } from "react";
import { ListChecks } from "lucide-react";
import { z } from "zod";
import { formFields } from "@/components/forms/fields";
import { FilterDialog } from "@/components/shared/filter-dialog";
import { FilterArchived, FilterSearch, FilterSelect } from "@/components/shared/filter-toolbar";
import { CardHeader, CardMeta, LedgerTableFrame } from "@/components/shared/ledger-table-frame";
import { NoMatches, NothingYet } from "@/components/shared/list-empty-states";
import { NewRecordButton } from "@/components/shared/new-record-button";
import type { PageLinks } from "@/components/shared/pagination";
import { RecordList } from "@/components/shared/record-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { TitledSection } from "@/components/shared/titled-section";
import { useRecordDialog } from "@/hooks/use-record-dialog";
import { useFilterDraft } from "@/hooks/use-filter-draft";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { appliedFilterCount, type PageInfo } from "@/lib/domain/filters";
import { GENERAL_KIND_IDS, GENERAL_KINDS, type GeneralItem, type GeneralKind } from "@/lib/domain/general";
import { generalItemDraftSchema, generalKindSchema, generalNameSchema } from "@/lib/domain/general.schema";
import { isArchived, showArchivedLabel } from "@/lib/domain/records";
import { routes } from "@/lib/domain/routes";
import { SHORTCUTS } from "@/lib/domain/shortcuts";
import { cn } from "@/lib/utils";
import { namedColumns } from "./named-columns";
import { NamedRowMenu } from "./named-row-menu";
import { RecordDialog } from "./record-dialog";

type ItemValues = { kind: GeneralKind; name: string };
const { TextField } = formFields<ItemValues>();

/** Where each list's items show up, and what archiving one means. */
const USED_FOR: Record<GeneralKind, { use: string; archive: string; renames: string; example: string }> = {
  destination: { use: "The booking form's Destination.", archive: "It won't be offered for new bookings.", renames: "bookings", example: "e.g. Goa" },
  package: { use: "The booking form's Package, and Package cost expenses.", archive: "It won't be offered for bookings or package costs.", renames: "bookings and expenses", example: "e.g. Goa Beach Camp" },
  route: { use: "The booking form's Route. \"Other\" (typed in) is always offered too.", archive: "It won't be offered for new bookings.", renames: "bookings", example: "e.g. Kochi-Munnar-Thekkady" },
  marketing: { use: "Marketing expenses' Channel. \"Other\" (with a description) is always offered too.", archive: "It won't be offered for marketing expenses.", renames: "expenses", example: "e.g. Meta Ads" },
  role: { use: "The team form's Role. Only people with the role Sales can close a booking, so keep that name.", archive: "It won't be offered for team members.", renames: "team members", example: "e.g. Sales" },
};

// The search belongs to the list it was typed for, so Reset clears it with the list
const FILTER_KEYS = ["list", "listSearch", "listArchived"] as const;

/** `list` is the page shown of `kind` for the search `q` (its archived items when `archived`; `empty`: none at all); `resetHref` is this list without its search or archived view. */
export function ListsSection({
  kind,
  list,
  counts,
  q,
  archived,
  links,
  resetHref,
}: {
  kind: GeneralKind;
  list: { items: GeneralItem[]; empty: boolean } & PageInfo;
  counts: Record<GeneralKind, number>;
  q: string;
  archived: boolean;
  links: PageLinks;
  resetHref: string;
}) {
  // Another list, or the archived view, starts at its first page
  const url = useUrlFilters(FILTER_KEYS, { pageParam: links.pageParam, archivedParam: "listArchived" });
  const { get, set, discard, apply, reset } = useFilterDraft(url, FILTER_KEYS);
  const { set: setUrl } = url;
  const onSearch = useCallback((listSearch: string) => setUrl({ listSearch }), [setUrl]);
  const { record: item, openNew, openEdit, dialog } = useRecordDialog<GeneralItem>({ shortcut: SHORTCUTS.addListItem, api: routes.api.general });
  const { one, title } = GENERAL_KINDS[kind];
  const things = title.toLowerCase();
  /** The list picked in the modal, before Apply. */
  const pickedThings = GENERAL_KINDS[(get("list") || "destination") as GeneralKind].title.toLowerCase();

  /** The dropdown's labels: "Packages · 3". */
  const listChoices = Object.fromEntries(GENERAL_KIND_IDS.map((k) => [k, `${GENERAL_KINDS[k].title} · ${counts[k]}`]));

  const menu = (i: GeneralItem) => (
    <NamedRowMenu
      record={i}
      url={routes.api.general.one(i.id)}
      what={GENERAL_KINDS[i.kind].one}
      things={GENERAL_KINDS[i.kind].title.toLowerCase()}
      archiveDescription={USED_FOR[i.kind].archive}
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
        className={cn("transition-opacity", url.isPending && "opacity-60")}
        filters={
          <div className="space-y-2">
            <FilterDialog
              search={<FilterSearch value={url.get("listSearch")} onSearch={onSearch} pending={url.isPending} placeholder={`Search ${things}…`} label={`Search ${things}`} />}
              // The list is always a choice made, like Trip status on Bookings
              count={appliedFilterCount({ list: kind, archived: archived ? "1" : "" })}
              pending={url.isPending}
              onApply={apply}
              onReset={reset}
              onDiscard={discard}
            >
              {/* Another list's items won't match this search */}
              <FilterSelect label="List" options={listChoices} value={get("list") || "destination"} onChange={(next) => set({ list: next === "destination" ? "" : next, listSearch: "" })} />
              <FilterArchived label={showArchivedLabel(pickedThings)} checked={get("listArchived") === "1"} onChange={(on) => set({ listArchived: on ? "1" : "" })} />
            </FilterDialog>
            {/* The picker is in the modal, so say which list this is */}
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{listChoices[kind]}</span> · {USED_FOR[kind].use}
            </p>
          </div>
        }
        page={list}
        links={links}
        label={`${title} pages`}
        noMatches={
          q || archived ? (
            <NoMatches plural={things} listHref={resetHref} archivedOnly={archived && !q} filtered />
          ) : list.empty ? (
            <NothingYet icon={ListChecks} title={`No ${things} yet`} description={`Add the ${things} the forms should offer.`} newLabel={`Add ${one}`} onNew={openNew} />
          ) : (
            <NothingYet
              icon={ListChecks}
              title={`No active ${things}`}
              description="They are all archived. Add one, or find them to restore under Filters."
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
        description={item ? `Renaming changes it for new ${USED_FOR[item.kind].renames}; what's already saved keeps the old name.` : `${title}: ${USED_FOR[kind].use}`}
        schema={item ? z.object({ kind: generalKindSchema, name: generalNameSchema(item.kind) }) : generalItemDraftSchema}
        defaultValues={{ kind: item?.kind ?? kind, name: item?.name ?? "" }}
        saved={item ? "Renamed." : `${one[0].toUpperCase()}${one.slice(1)} added.`}
      >
        <TextField name="name" label="Name" placeholder={USED_FOR[item?.kind ?? kind].example} autoComplete="off" maxLength={GENERAL_KINDS[item?.kind ?? kind].max} autoFocus required />
      </RecordDialog>
    </TitledSection>
  );
}
