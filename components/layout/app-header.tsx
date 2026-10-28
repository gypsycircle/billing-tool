// components/layout/app-header.tsx
// Slim top bar on paper with a hairline border. Server component; only the
// nav, command menu, theme toggle and logout button are client islands.

import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { LogoutButton } from "@/components/auth/logout-button";
import { CommandMenu } from "@/components/layout/command-menu";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-stretch gap-4 px-4 sm:px-6">
        <Link
          href="/bookings"
          className="flex items-center gap-3 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <BrandMark className="h-7 text-brand" />
          <span className="hidden h-5 w-px bg-rule md:block" aria-hidden />
          <span className="eyebrow hidden text-muted-foreground md:block">Billing ledger</span>
        </Link>

        <div className="ml-2 hidden sm:block">
          <NavLinks />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <CommandMenu />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      {/* Small screens: nav on its own row */}
      <div className="h-10 border-t sm:hidden">
        <div className="mx-auto h-full max-w-6xl px-1">
          <NavLinks />
        </div>
      </div>
    </header>
  );
}
