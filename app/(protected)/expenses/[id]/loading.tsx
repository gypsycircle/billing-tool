// app/(protected)/expenses/[id]/loading.tsx
// Shown the moment a link to this page is clicked, while the server renders it.

import { ExpenseSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return <ExpenseSkeleton />;
}
