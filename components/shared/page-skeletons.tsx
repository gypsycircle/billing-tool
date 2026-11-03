// components/shared/page-skeletons.tsx
// Loading states shaped like each page, shown the moment a link is clicked
// (the routes' loading.tsx). Next.js prefetches them with the link, so a page
// change shows its outline at once while the server renders the real page.

import { Skeleton } from "@/components/ui/skeleton";
import { NAMED_PAGE_SIZE } from "@/lib/domain/named-records";
import { cn } from "@/lib/utils";
import { CARD, FORM_BUTTON, FORM_FIELDS, FORM_PAGE, FORM_SECTION, PAGE_HEADER, RECORD_BAND, RECORD_PARTIES, STAT_COLUMNS, STAT_GRID } from "./layout-classes";

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
    <div className={cn(STAT_GRID, "mb-10", STAT_COLUMNS[columns])}>
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

/** A list page (bookings, expenses): header, its figures, filters and table rows. */
export function LedgerSkeleton({ tiles, label }: { tiles: 2 | 4; label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <HeaderSkeleton actions={1} />
      <TilesSkeleton count={tiles} columns={tiles} />
      <div className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 min-w-40 flex-1 basis-40" />
          ))}
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
  );
}

/** A section's heading, its button, and table rows. */
function SectionSkeleton({ picker = false }: { picker?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      {/* The toolbar: the team's search, or the list picker and where it's used; then Show archived */}
      <div className="flex items-center gap-2">
        {picker ? (
          <>
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="hidden h-4 w-48 sm:block" />
          </>
        ) : (
          <Skeleton className="h-9 flex-1" />
        )}
        <Skeleton className="ml-auto h-9 w-36 shrink-0" />
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
      <div className="space-y-10">
        <SectionSkeleton />
        <SectionSkeleton picker />
      </div>
    </div>
  );
}

/**
 * A record's page (booking, expense): header with its actions, then its card
 * (RecordDocument): the band of four facts, and the body.
 */
export function RecordSkeleton({ label, actions }: { label: string; actions: number }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <HeaderSkeleton actions={actions} />
      <div className={cn(CARD, "overflow-hidden")}>
        <div className={cn(RECORD_BAND, "sm:grid-cols-4")}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className={RECORD_PARTIES}>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-48 max-w-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2 sm:justify-items-end sm:text-right">
            <Skeleton className="h-3 w-16 sm:ml-auto" />
            <Skeleton className="h-6 w-36 sm:ml-auto" />
          </div>
        </div>
        <div className="space-y-2 border-t px-6 py-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
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
