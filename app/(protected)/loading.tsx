// app/(protected)/loading.tsx
// Route-level loading state for every signed-in page without its own: a page
// header and one content panel, sketched.

import { PageSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return <PageSkeleton />;
}
