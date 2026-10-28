// app/global-error.tsx
// Last-resort boundary for errors in the root layout. It replaces the root
// layout, so it brings its own <html>/<body> and stylesheet, and uses no
// providers (the theme falls back to light).

"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error.digest ?? "no digest");
  }, [error]);

  return (
    <html lang="en">
      <body>
        <StatusPage
          mark="—"
          title="The ledger couldn't load"
          description="A critical error occurred. Please refresh the page or try again."
          actions={<Button onClick={reset}>Try again</Button>}
        />
      </body>
    </html>
  );
}
