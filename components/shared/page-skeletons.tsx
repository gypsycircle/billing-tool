// components/shared/page-skeletons.tsx
// Loading states shaped like each page, shown the moment a link is clicked
// (the routes' loading.tsx). Next.js prefetches them with the link, so a page
// change shows its outline at once while the server renders the real page.

import { Skeleton } from "@/components/ui/skeleton";

function HeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="rule-double mb-8 flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
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

/** The bookings ledger: header, four figures, filters and table rows. */
export function LedgerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading bookings">
      <HeaderSkeleton actions={1} />
      <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 bg-card px-5 py-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 min-w-40 flex-1 basis-40" />
          ))}
        </div>
        <div className="divide-y rounded-xl border bg-card">
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

/** A booking: header with actions, then the bill-shaped document. */
export function DocumentSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading booking">
      <HeaderSkeleton actions={3} />
      <div className="space-y-6 rounded-xl border bg-card p-6 sm:p-8">
        <div className="flex justify-between gap-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-28 w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-20 w-64 max-w-full" />
        </div>
      </div>
    </div>
  );
}

/** The booking form (new and edit): numbered sections of fields. */
export function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading form">
      <HeaderSkeleton />
      <div className="space-y-10">
        {Array.from({ length: 3 }, (_, section) => (
          <div key={section} className="grid gap-6 border-b pb-10 md:grid-cols-[14rem_1fr]">
            <div className="space-y-2">
              <Skeleton className="h-7 w-8" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
