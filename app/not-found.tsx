// app/not-found.tsx
// 404 — never exposes paths or internals. Signed-out visitors to unknown URLs
// are sent to the access page (/) by proxy.ts first, so only signed-in users see this.

import Link from "next/link";
import { routes } from "@/lib/domain/routes";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shared/status-page";

export default function NotFound() {
  return (
    <StatusPage
      mark="404"
      title="This page isn't in the ledger"
      description="The link may be mistyped, or the page may no longer exist."
      actions={
        <Button nativeButton={false} render={<Link href={routes.bookings.list} />}>
          Back to bookings
        </Button>
      }
    />
  );
}
