// components/forms/form-section.tsx
// A numbered ledger entry: "01 Invoice" on the left, its fields on the right.
// Shared by every form (bookings, expenses).

import { FORM_FIELDS, FORM_SECTION } from "@/components/shared/layout-classes";
import { cn } from "@/lib/utils";

export function FormSection({
  number,
  title,
  description,
  children,
  className,
}: {
  number: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = `section-${number}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(FORM_SECTION, className)}
    >
      <div>
        <p className="font-heading text-3xl leading-none font-light text-muted-foreground/45 tabular" aria-hidden>
          {number}
        </p>
        <h2 id={id} className="mt-2 font-medium">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      <div className={FORM_FIELDS}>{children}</div>
    </section>
  );
}
