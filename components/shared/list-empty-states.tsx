// components/shared/list-empty-states.tsx
// What a list (bookings, expenses, Settings' team and lists) shows instead of
// its table: nothing recorded yet, or nothing matching the filters / nothing archived.

import Link from "next/link";
import { Plus, SearchX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

/** No records at all yet, with the way to add the first: its form's page, or a dialog (`onNew`). */
export function NothingYet({
  icon,
  title,
  description,
  newHref,
  onNew,
  newLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  newLabel: string;
} & ({ newHref: string; onNew?: never } | { onNew: () => void; newHref?: never })) {
  const content = (
    <>
      <Plus />
      {newLabel}
    </>
  );
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        newHref ? (
          <Button variant="outline" nativeButton={false} render={<Link href={newHref} />}>
            {content}
          </Button>
        ) : (
          <Button variant="outline" onClick={onNew}>
            {content}
          </Button>
        )
      }
    />
  );
}

/** Records exist, but none in this view. `plural`: "bookings", "expenses". */
export function NoMatches({
  plural,
  listHref,
  archivedOnly,
  filtered,
}: {
  plural: string;
  listHref: string;
  /** The archived view with no other filter set. */
  archivedOnly: boolean;
  /** Any filter is set. */
  filtered: boolean;
}) {
  return (
    <EmptyState
      icon={SearchX}
      title={archivedOnly ? `No archived ${plural}` : `No ${plural} match`}
      description={
        archivedOnly
          ? `${plural[0].toUpperCase()}${plural.slice(1)} you archive appear here, ready to restore.`
          : filtered
          ? "Try a different search, or reset the filters."
          : `There are no ${plural} to show.`
      }
      action={
        <Button variant="outline" nativeButton={false} render={<Link href={listHref} />}>
          Reset filters
        </Button>
      }
    />
  );
}
