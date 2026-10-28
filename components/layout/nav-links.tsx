// components/layout/nav-links.tsx
// Primary navigation. The active link is marked with a brand-teal rule that
// sits on the header's bottom border, like an underlined ledger entry.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/bookings", label: "Bookings", match: (path: string) => path === "/bookings" || /^\/bookings\/(?!new)/.test(path) },
  { href: "/bookings/new", label: "New booking", match: (path: string) => path === "/bookings/new" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex h-full items-stretch gap-1">
      {NAV_ITEMS.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center px-3 text-sm transition-colors",
              "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors",
              active
                ? "font-medium text-foreground after:bg-brand"
                : "text-muted-foreground after:bg-transparent hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
