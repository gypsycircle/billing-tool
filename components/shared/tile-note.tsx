// components/shared/tile-note.tsx
// Something to act on, kept off a tile until it's wanted (Stat's `note`): a note
// icon with a pulsing dot, opening its message on hover, click, tap or keyboard.
// A Popover, as a Tooltip closes on click and doesn't open on touch screens.

"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function TileNote({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={100}
        closeDelay={150}
        render={<Button variant="ghost" size="icon-xs" aria-label="Show note" className="relative -my-1 text-status-partial hover:text-status-partial" />}
      >
        <StickyNote aria-hidden />
        <span className="absolute top-0.5 right-0.5 flex size-1.5" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-status-partial opacity-75 motion-reduce:hidden" />
          <span className="relative size-1.5 rounded-full bg-status-partial" />
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={8} className="block w-fit max-w-xs bg-foreground px-3 py-1.5 text-xs text-background ring-0">
        {children}
        <PopoverPrimitive.Arrow className="size-2.5 rotate-45 rounded-[2px] bg-foreground data-[side=bottom]:-top-1 data-[side=top]:-bottom-1" />
      </PopoverContent>
    </Popover>
  );
}
