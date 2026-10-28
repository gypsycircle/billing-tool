// app/(protected)/bookings/[id]/edit/loading.tsx
// Shown the moment a link to this page is clicked, while the server renders it.

import { FormSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return <FormSkeleton />;
}
