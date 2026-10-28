// app/error.tsx
// Error boundary for rendering errors. Never shows stack traces, paths or
// configuration — only the digest is logged, for matching with server logs.

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shared/status-page";

export default function ErrorPage({
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
    <StatusPage
      mark="—"
      title="Something went wrong"
      description="The page couldn't be loaded. Try again — if it keeps happening, the database may be unreachable for a moment."
      actions={
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
