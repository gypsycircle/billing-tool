// components/layout/command-menu.tsx
// Command palette and keyboard shortcuts:
//   ⌘K / Ctrl+K or "/"  open the palette
//   N                   new booking
// Typing also searches bookings on the server (debounced): the newest ones
// show when the menu opens, matches as you type. The server does the matching
// (cmdk's own filter is off for them), so results carry only what is shown.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { defaultFilter } from "cmdk";
import { BookOpen, Download, FileText, LogOut, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { THEME_OPTIONS } from "@/components/layout/theme-toggle";
import { useHotkey } from "@/hooks/use-hotkey";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useLogout } from "@/hooks/use-logout";
import { apiFetch } from "@/lib/client/api-client";
import type { BookingSearchHit } from "@/lib/domain/types";

const BOOKING_ITEM = "booking-";

/** Bookings were matched by the server, so they always show; commands are matched as usual. */
const filterItems = (value: string, search: string, keywords?: string[]) =>
  value.startsWith(BOOKING_ITEM) ? 1 : defaultFilter(value, search, keywords);

export function CommandMenu() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { logout } = useLogout();
  const { canInstall, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [bookings, setBookings] = useState<BookingSearchHit[] | null>(null);

  // Ask the server for a few matching bookings while the menu is open;
  // the last results stay visible while the next ones load
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const query = search.trim();
    const timer = setTimeout(() => {
      const url = `/api/bookings?view=search&q=${encodeURIComponent(query.slice(0, 100))}`;
      apiFetch<{ items: BookingSearchHit[] }>(url).then(({ data }) => {
        if (!cancelled && data) setBookings(data.items);
      });
    }, query ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, search]);

  useHotkey("k", () => setOpen((o) => !o), { mod: true });
  useHotkey("/", () => setOpen(true));
  useHotkey("n", () => router.push("/bookings/new"), { enabled: !open });

  /** Closes the palette, then runs the action. */
  const run = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8 w-9 justify-center gap-2 bg-card px-0 text-muted-foreground shadow-none hover:text-foreground sm:w-56 sm:justify-start sm:px-2.5"
        aria-label="Open command menu"
      >
        <Search />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search or jump to…</span>
        {/* "/" works on every platform; ⌘K / Ctrl+K also open the menu */}
        <Kbd className="hidden sm:inline-flex">/</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
        title="Command menu"
        description="Jump to a page or run a command."
      >
        <Command filter={filterItems}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search bookings or type a command…" />
          <CommandList className="max-h-[min(26rem,60vh)]">
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            <CommandGroup heading="Go to">
              <CommandItem onSelect={() => run(() => router.push("/bookings"))}>
                <BookOpen />
                Bookings
              </CommandItem>
              <CommandItem onSelect={() => run(() => router.push("/bookings/new"))}>
                <Plus />
                New booking
                <CommandShortcut>N</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            {bookings && bookings.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Bookings">
                  {bookings.map((b) => (
                    <CommandItem
                      key={b.bookingId}
                      value={`${BOOKING_ITEM}${b.bookingId}`}
                      onSelect={() => run(() => router.push(`/bookings/${b.bookingId}`))}
                    >
                      <FileText />
                      <span className="shrink-0 whitespace-nowrap tabular text-muted-foreground">No. {b.invoiceNumber}</span>
                      <span className="truncate">{b.customerName}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">{b.packageName}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            <CommandSeparator />
            <CommandGroup heading="Appearance">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <CommandItem key={value} onSelect={() => run(() => setTheme(value))}>
                  <Icon />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
            {canInstall && (
              <>
                <CommandSeparator />
                <CommandGroup heading="App">
                  <CommandItem onSelect={() => run(() => void install())}>
                    <Download />
                    Install app
                  </CommandItem>
                </CommandGroup>
              </>
            )}
            <CommandSeparator />
            <CommandGroup heading="Session">
              <CommandItem onSelect={() => run(() => void logout())}>
                <LogOut />
                Log out
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
