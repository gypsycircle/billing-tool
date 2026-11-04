// components/shared/page-header.tsx
// Page title block: optional back link, eyebrow, serif title, description,
// actions — closed by a ledger double rule.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_HEADER } from "./layout-classes";

interface PageHeaderProps {
  title: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}

/** A header's buttons: they keep their own width (left-aligned on phones). */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  return <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>;
}

export function PageHeader({ title, eyebrow, description, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cn(PAGE_HEADER, className)}>
      <div className="min-w-0 space-y-3">
        {back && (
          <Link
            href={back.href}
            className="group flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        )}
        <div className="space-y-2">
          {eyebrow && <p className="eyebrow text-brand">{eyebrow}</p>}
          <h1 className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-[2.5rem] sm:leading-[1.1]">
            {title}
          </h1>
          {description && <p className="max-w-prose text-pretty text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <HeaderActions>{actions}</HeaderActions>}
    </header>
  );
}
