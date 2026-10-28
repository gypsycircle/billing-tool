// components/bookings/bill-problems.tsx
// Shown on a booking that can't be printed: only possible for a booking changed
// outside the app (e.g. directly in the database), since saving through the
// app refuses values that don't fit.

import Link from "next/link";
import { FileWarning, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BillProblemsProps {
  bookingId: string;
  problems: string[];
}

export function BillProblems({ bookingId, problems }: BillProblemsProps) {
  return (
    <section
      role="alert"
      className="mb-6 flex flex-col gap-4 rounded-lg border border-status-unpaid/25 bg-status-unpaid-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <FileWarning className="mt-0.5 size-4 shrink-0 text-status-unpaid" aria-hidden />
        <div>
          <p className="font-medium text-status-unpaid">This booking can&apos;t be printed on the Bill of Supply yet.</p>
          <ul className="mt-1 space-y-0.5 text-foreground/80">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start bg-card sm:self-center"
        nativeButton={false}
        render={<Link href={`/bookings/${bookingId}/edit`} />}
      >
        <Pencil />
        Fix in edit
      </Button>
    </section>
  );
}
