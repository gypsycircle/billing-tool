// components/layout/nav-links.tsx
// Primary navigation. The active link is marked with a brand-teal rule that
// sits on the header's bottom border, like an underlined ledger entry.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/domain/routes";
import { cn } from "@/lib/utils";

// Each section's page and everything under it ("New booking" / "Add expense"
// are buttons on their pages, in ⌘K and on the B / E keys)
const section = (href: string) => (path: string) => path === href || path.startsWith(`${href}/`);
const NAV_ITEMS = [
  { href: routes.bookings.list, label: "Bookings", match: section(routes.bookings.list) },
  { href: routes.expenses.list, label: "Expenses", match: section(routes.expenses.list) },
  { href: routes.settings.page, label: "Settings", match: section(routes.settings.page) },
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
