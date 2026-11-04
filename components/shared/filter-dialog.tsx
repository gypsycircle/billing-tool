// components/shared/filter-dialog.tsx
// A list's filters behind one button: the search beside it, a count on it of the
// filters applied, and a modal of labelled fields (FilterSelect, FilterDateRange,
// FilterArchived from filter-toolbar.tsx) with Reset and Apply.
// The list passes its own fields as children and holds them in useFilterDraft.
// Calendars open centred on the modal (FilterDialogElement), so nothing in it moves.

"use client";

import { createContext, useCallback, useRef, useState } from "react";
import { ListFilter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** The open modal, for the calendars its fields open to centre on. */
export const FilterDialogElement = createContext<HTMLElement | null>(null);

export function FilterDialog({
  search,
  count,
  pending,
  onApply,
  onReset,
  onDiscard,
  children,
}: {
  /** The list's search box, beside the button and filling the row. */
  search?: React.ReactNode;
  /** How many filters are applied. */
  count: number;
  /** A filtered page is loading. */
  pending: boolean;
  onApply: () => void;
  onReset: () => void;
  /** The modal has closed and faded out: the choices are dropped (not before, so nothing in it moves while it fades). */
  onDiscard: () => void;
  /** The fields. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const popup = useRef<HTMLDivElement | null>(null);
  const popupRef = useCallback((node: HTMLDivElement | null) => {
    popup.current = node;
    setElement(node);
  }, []);
  const closeAfter = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div className="flex items-start gap-2">
      {search && <div className="min-w-0 flex-1">{search}</div>}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(next) => {
          if (!next) onDiscard();
        }}
      >
        <DialogTrigger
          render={
            <Button variant="outline" size="lg" className={cn("shrink-0 bg-card", count > 0 && "border-brand/50")}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ListFilter aria-hidden />}
              {/* The icon alone on phones */}
              <span className="max-sm:sr-only">Filters</span>
              {count > 0 && (
                <span className="tabular flex size-5 items-center justify-center rounded-full bg-brand text-xs font-medium text-brand-foreground">
                  {count}
                  <span className="sr-only"> applied</span>
                </span>
              )}
            </Button>
          }
        />
        {/* Focus starts on the modal itself, so no field shows a focus ring on opening */}
        <DialogContent ref={popupRef} initialFocus={popup} className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[34rem]">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <FilterDialogElement.Provider value={element}>
            <div className="-mx-4 -my-1 grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 py-1 sm:grid-cols-2">{children}</div>
          </FilterDialogElement.Provider>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button variant="ghost" className="text-muted-foreground" onClick={closeAfter(onReset)}>
              Reset
            </Button>
            <Button onClick={closeAfter(onApply)}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
