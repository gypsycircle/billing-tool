// app/(protected)/bookings/loading.tsx
// Shown the moment a link to this page is clicked, while the server renders it.

import { LedgerSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return <LedgerSkeleton />;
}
