// components/layout/command-menu.tsx
// Command palette and keyboard shortcuts:
//   ⌘K / Ctrl+K or "/"  open the palette
//   N                   new booking
// Bookings are searched in the ledger's own search box, not here.

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { BookOpen, Download, LogOut, Plus, Search } from "lucide-react";
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

export function CommandMenu() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { logout } = useLogout();
  const { canInstall, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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
        <span className="hidden flex-1 text-left font-normal sm:inline">Jump to…</span>
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
        <Command>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Type a command…" />
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
