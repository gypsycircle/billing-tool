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
        "ledger-lines space-y-7 rounded-xl border border-dashed border-rule bg-card px-6 py-16 text-center",
        className
      )}
    >
      <div className="space-y-5">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-rule bg-background text-brand">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-xl font-medium">{title}</h2>
          {description && <p className="mx-auto max-w-md text-sm text-pretty text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  );
}
