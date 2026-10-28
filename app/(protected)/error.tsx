// app/(protected)/error.tsx
// Errors inside the signed-in app keep the header and navigation, so the user
// can retry or move elsewhere. Only the digest is logged — never details.

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error.digest ?? "no digest");
  }, [error]);

  return (
    <EmptyState
      icon={CloudOff}
      title="This page couldn't be loaded"
      description="The database may be unreachable for a moment. Try again — nothing you saved has been lost."
      action={
        <>
          <Button onClick={reset}>
            <RotateCcw />
            Try again
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/bookings" />}>
            Back to bookings
          </Button>
        </>
      }
    />
  );
}
