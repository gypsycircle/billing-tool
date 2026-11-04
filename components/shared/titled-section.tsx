// components/shared/titled-section.tsx
// One section of a page (Settings' team and lists, a booking's history): a heading
// with what it's for, its main action, then its content. `id` is where links land.

import { cn } from "@/lib/utils";
import { SECTION_STACK } from "./layout-classes";
import { HeaderActions } from "./page-header";

export function TitledSection({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-24", SECTION_STACK)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 id={`${id}-heading`} className="font-heading text-2xl font-medium">
            {title}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        </div>
        {action && <HeaderActions>{action}</HeaderActions>}
      </div>
      {children}
    </section>
  );
}
