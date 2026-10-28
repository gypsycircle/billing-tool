// components/shared/empty-state.tsx
// A quiet "nothing here yet" panel on faint ruled-paper lines.

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        "ledger-lines rounded-xl border border-dashed border-rule bg-card px-6 py-16 text-center",
        className
      )}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-rule bg-background text-brand">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="mt-5 font-heading text-xl font-medium">{title}</h2>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-7 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  );
}
