// components/shared/page-header.tsx
// Page title block: optional back link, eyebrow, serif title, description,
// actions — closed by a ledger double rule.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}

export function PageHeader({ title, eyebrow, description, actions, back, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "rule-double mb-8 flex flex-col gap-5 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {back && (
          <Link
            href={back.href}
            className="group mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="eyebrow text-brand">{eyebrow}</p>}
        <h1 className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-[2.5rem] sm:leading-[1.1]">
          {title}
        </h1>
        {description && <p className="max-w-prose text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
