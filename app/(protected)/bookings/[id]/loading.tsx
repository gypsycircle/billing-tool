// app/(protected)/bookings/[id]/loading.tsx
// Shown the moment a link to this page is clicked, while the server renders it.

import { RecordSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return <RecordSkeleton label="Loading booking" actions={3} />;
}
