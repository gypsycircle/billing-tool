// components/shared/record-list.tsx
// A list of records (bookings, expenses, Settings' team and lists) below its
// header: the empty state when there are none at all; otherwise the filters,
// then the page of rows with its pager, or a note that nothing matches.

import type { PageInfo } from "@/lib/domain/filters";
import { cn } from "@/lib/utils";
import { Pagination, type PageLinks } from "./pagination";

export function RecordList({
  id,
  empty,
  filters,
  table,
  noMatches,
  page,
  links,
  label,
  className,
}: {
  /** Where the pager's links land (the list's anchor). */
  id?: string;
  /** Shown alone when there are no records at all (NothingYet); null otherwise. */
  empty?: React.ReactNode;
  filters?: React.ReactNode;
  /** The page of rows (shown when something matches). */
  table: React.ReactNode;
  /** Shown under the filters when nothing matches them. */
  noMatches?: React.ReactNode;
  page: PageInfo;
  links: PageLinks;
  /** The pager's name for screen readers ("Team pages"). */
  label?: string;
  className?: string;
}) {
  if (empty) return empty;
  return (
    <div id={id} className={cn("scroll-mt-24 space-y-4", className)}>
      {filters}
      {page.total > 0 ? (
        <>
          {table}
          <Pagination links={links} page={page} label={label} />
        </>
      ) : (
        noMatches
      )}
    </div>
  );
}
