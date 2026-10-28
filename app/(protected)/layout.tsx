// app/(protected)/layout.tsx
// Protected route group layout. Verifies the session (Layer 2) before
// rendering anything; proxy.ts has already done the optimistic check.
// Layouts don't re-render on client navigation, so data access must still
// go through lib/server/bookings/service.ts, which verifies again.

import { requireSessionOrRedirect } from "@/lib/server/guards";
import { AppHeader } from "@/components/layout/app-header";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  await requireSessionOrRedirect();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
