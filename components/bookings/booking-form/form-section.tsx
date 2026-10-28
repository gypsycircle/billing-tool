// components/bookings/booking-form/form-section.tsx
// A numbered ledger entry: "01 Invoice" on the left, its fields on the right.

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
      className={cn("grid gap-5 border-t pt-8 first:border-t-0 first:pt-0 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-8", className)}
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
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
