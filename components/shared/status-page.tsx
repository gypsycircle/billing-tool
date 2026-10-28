// components/shared/status-page.tsx
// Full-page message used by 404 and error screens: a large serif numeral or
// mark, a double rule, a short explanation and actions.

import { BrandMark } from "@/components/brand/brand-mark";

export function StatusPage({
  mark,
  title,
  description,
  actions,
}: {
  mark: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <BrandMark className="h-8 text-brand" />
      <p className="mt-12 font-heading text-7xl font-light tracking-tight text-muted-foreground/60 tabular sm:text-8xl">
        {mark}
      </p>
      <div className="rule-double mx-auto mt-6 w-24" aria-hidden />
      <h1 className="mt-6 font-heading text-2xl font-medium sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-md text-pretty text-muted-foreground">{description}</p>
      {actions && <div className="mt-8 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
