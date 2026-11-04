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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-12 px-6 py-16 text-center">
      <BrandMark className="h-8 text-brand" />
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-6">
          <p className="font-heading text-7xl font-light tracking-tight text-muted-foreground/60 tabular sm:text-8xl">{mark}</p>
          <div className="rule-double w-24" aria-hidden />
          <div className="flex flex-col items-center gap-3">
            <h1 className="font-heading text-2xl font-medium sm:text-3xl">{title}</h1>
            <p className="max-w-md text-pretty text-muted-foreground">{description}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
