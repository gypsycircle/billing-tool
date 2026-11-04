// components/shared/status-notice.tsx
// A note above a page's content, with its tone's icon and colours: a record that
// isn't active, a range that couldn't be used, a bill that can't be printed.
// `action`: a button at its end.

import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "info" | "success" | "warning" | "danger";

const TONES: Record<NoticeTone, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "border-brand/25 bg-accent text-accent-foreground" },
  success: { icon: CircleCheck, className: "border-status-paid/25 bg-status-paid-soft text-status-paid" },
  warning: { icon: TriangleAlert, className: "border-status-partial/25 bg-status-partial-soft text-status-partial" },
  danger: { icon: CircleAlert, className: "border-status-unpaid/25 bg-status-unpaid-soft text-status-unpaid" },
};

export function StatusNotice({ tone = "info", action, children }: { tone?: NoticeTone; action?: React.ReactNode; children: React.ReactNode }) {
  const { icon: Icon, className } = TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("flex flex-col gap-3 rounded-lg border border-dashed px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">{children}</div>
      </div>
      {action}
    </div>
  );
}
