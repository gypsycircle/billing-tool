// components/shared/page-skeletons.tsx
// Loading states shaped like each page, shown the moment a link is clicked
// (the routes' loading.tsx). Next.js prefetches them with the link, so a page
// change shows its outline at once while the server renders the real page.

import { Skeleton } from "@/components/ui/skeleton";
import { NAMED_PAGE_SIZE } from "@/lib/domain/named-records";
import { cn } from "@/lib/utils";
import { CARD, CARD_STACK, FORM_BUTTON, FORM_FIELDS, FORM_PAGE, FORM_SECTION, LIST_STACK, PAGE_BODY, PAGE_GROUP, PAGE_HEADER, RECORD_BAND, RECORD_FOOT, RECORD_PANEL, RECORD_PARTIES, SECTION_STACK, STAT_COLUMNS, STAT_GRID } from "./layout-classes";

function HeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className={PAGE_HEADER}>
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

/** A page's figures (StatGroup): `count` tiles, `columns` a row on wide screens. */
function TilesSkeleton({ count, columns }: { count: number; columns: keyof typeof STAT_COLUMNS }) {
  return (
    <div className={cn(STAT_GRID, STAT_COLUMNS[columns])}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 bg-card px-5 py-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function LedgerSkeleton({ tiles, label, search = false }: { tiles: 2 | 4; label: string; search?: boolean }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <HeaderSkeleton actions={1} />
      <div className={PAGE_BODY}>
      <TilesSkeleton count={tiles} columns={tiles} />
      <div className={LIST_STACK}>
        <div className="flex gap-2">
          {search && <Skeleton className="h-9 flex-1" />}
          <Skeleton className="h-9 w-28" />
        </div>
        <div className={cn(CARD, "divide-y")}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-4">
              <Skeleton className="h-4 w-28" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="hidden h-4 w-20 md:block" />
              <Skeleton className="hidden h-4 w-20 md:block" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

/** A section's heading, its button, and table rows. */
function SectionSkeleton({ line = false }: { line?: boolean }) {
  return (
    <div className={SECTION_STACK}>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      {/* The toolbar: the search, then Filters; `line`: which list is open */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9 shrink-0 sm:w-24" />
        </div>
        {line && <Skeleton className="h-4 w-64 max-w-full" />}
      </div>
      <div className={cn(CARD, "divide-y")}>
        <div className="flex h-10 items-center px-5">
          <Skeleton className="h-3 w-16" />
        </div>
        {Array.from({ length: NAMED_PAGE_SIZE }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-4">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Settings: the team and the lists, laid out as the page is. */
export function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading settings">
      <HeaderSkeleton />
      <div className={PAGE_BODY}>
        <SectionSkeleton />
        <SectionSkeleton line />
      </div>
    </div>
  );
}

/** A record page's header: back link, its number, its title, the row of one fact and two badges, when it was updated, and its buttons (their widths). */
function RecordHeaderSkeleton({ actions }: { actions: readonly string[] }) {
  return (
    <div className={PAGE_HEADER}>
      <div className="min-w-0 space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-64 max-w-full sm:h-11" />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((width, i) => (
          <Skeleton key={i} className={cn("h-9", width)} />
        ))}
      </div>
    </div>
  );
}

/** The grey band of four facts (RecordDocument). */
function BandSkeleton() {
  return (
    <div className={cn(RECORD_BAND, "sm:grid-cols-4")}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-24 max-w-full" />
        </div>
      ))}
    </div>
  );
}

/** A label over a name and a line (PartyBlock). */
function PartySkeleton({ right = false }: { right?: boolean }) {
  const end = right && "sm:ml-auto";
  return (
    <div className="space-y-2">
      <Skeleton className={cn("h-4 w-16", end)} />
      <div className="space-y-1">
        <Skeleton className={cn("w-48 max-w-full", right ? "h-6" : "h-8", end)} />
        <Skeleton className={cn("h-5 w-32", end)} />
      </div>
    </div>
  );
}

/** Notes on the left; figures and the amount in words on the right (NotesAndFigures). */
function RecordFootSkeleton({ rows }: { rows: number }) {
  return (
    <div className={RECORD_FOOT}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-5 w-40 max-w-full" />
      </div>
      <div className="space-y-5">
        <div className="space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className={cn("w-28", i === 0 ? "h-7" : "h-5")} />
              <Skeleton className={cn("w-16", i === 0 ? "h-7" : "h-5")} />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Skeleton className="ml-auto h-4 w-36" />
          <Skeleton className="ml-auto h-5 w-44" />
        </div>
      </div>
    </div>
  );
}

/**
 * A booking's page, block for block: its header; the bill (band, bill to and
 * trip, the services, notes and figures); the panel of what's never printed;
 * and its history. While loading it can't know if the booking is cancelled, so
 * the notice and the Cancellation section arrive with the page.
 */
export function BookingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading booking">
      <RecordHeaderSkeleton actions={["w-20", "w-9", "w-32 sm:w-40", "w-20"]} />
      <div className={PAGE_BODY}>
        <div className={PAGE_GROUP}>
          <div className={cn(CARD, "overflow-hidden")}>
            <BandSkeleton />
            <div className={RECORD_PARTIES}>
              <PartySkeleton />
              <PartySkeleton right />
            </div>
            {/* The services: stacked on phones, a table from sm */}
            <div className="space-y-2 border-y-2 border-foreground/10 px-6 py-4 sm:hidden">
              <Skeleton className="h-4 w-16" />
              <div className="space-y-4">
                <div className="space-y-1">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden px-3 pb-2 sm:block">
              <div className="flex h-10 items-center justify-between border-y-2 border-foreground/10 px-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="flex items-start justify-between gap-6 px-3 py-3">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-64 max-w-full" />
                </div>
                <Skeleton className="h-5 w-48" />
              </div>
              <div className="flex h-11.5 items-center justify-between border-y-2 border-foreground/10 px-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <RecordFootSkeleton rows={3} />
          </div>
          <div className={RECORD_PANEL}>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-40 max-w-full" />
            </div>
            <div className="space-y-2 border-t border-rule pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-40 max-w-full" />
            </div>
          </div>
        </div>
        <div className={SECTION_STACK}>
          <div className="space-y-1">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-10 w-96 max-w-full" />
          </div>
          {/* The table from md, cards on phones */}
          <div className={cn(CARD, "hidden divide-y md:block")}>
            <div className="flex h-10 items-center px-5">
              <Skeleton className="h-3 w-16" />
            </div>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-6 px-5 py-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-4 w-64 max-w-full" />
              </div>
            ))}
          </div>
          <div className={cn(CARD_STACK, "md:hidden")}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={cn(CARD, CARD_STACK, "p-4")}>
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** An expense's page: its header, then its card: the band, Paid for, and notes beside the amount. */
export function ExpenseSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading expense">
      <RecordHeaderSkeleton actions={["w-20", "w-20"]} />
      <div className={cn(CARD, "overflow-hidden")}>
        <BandSkeleton />
        <div className="px-6 py-6">
          <PartySkeleton />
        </div>
        <div className="mx-3 border-t-2 border-foreground/10" aria-hidden />
        <RecordFootSkeleton rows={1} />
      </div>
    </div>
  );
}

/**
 * A record's form (new and edit; RecordFormLayout): numbered sections of
 * fields (FormSection), and the summary with the save buttons beside them.
 */
export function FormSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <HeaderSkeleton />
      <div className={FORM_PAGE}>
        <div className="space-y-8">
          {Array.from({ length: 3 }, (_, section) => (
            <div key={section} className={FORM_SECTION}>
              <div className="space-y-2">
                <Skeleton className="h-7 w-8" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className={FORM_FIELDS}>
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className={FORM_BUTTON} />
        </div>
      </div>
    </div>
  );
}

/** Any other signed-in page while it loads: its header and one panel. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className={cn(CARD, "space-y-4 p-6")}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
