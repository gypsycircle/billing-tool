// app/(protected)/loading.tsx
// Route-level loading state for every signed-in page: a page header and one
// content panel, sketched — neutral enough for the dashboard, form or detail.

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="rule-double mb-8 space-y-3 pb-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
