// components/bookings/bill-problems.tsx
// Shown on a booking that can't be printed: only possible for a booking changed
// outside the app (e.g. directly in the database), since saving through the
// app refuses values that don't fit.

import Link from "next/link";
import { routes } from "@/lib/domain/routes";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/shared/status-notice";

interface BillProblemsProps {
  bookingId: string;
  problems: string[];
}

export function BillProblems({ bookingId, problems }: BillProblemsProps) {
  return (
    <StatusNotice
      tone="danger"
      action={
        <Button variant="outline" size="sm" className="self-start bg-card sm:self-center" nativeButton={false} render={<Link href={routes.bookings.edit(bookingId)} />}>
          <Pencil />
          Fix in edit
        </Button>
      }
    >
      <div className="space-y-1">
        <p className="font-medium">This booking can&apos;t be printed on the Bill of Supply yet.</p>
        <ul className="space-y-0.5 text-foreground/80">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    </StatusNotice>
  );
}
