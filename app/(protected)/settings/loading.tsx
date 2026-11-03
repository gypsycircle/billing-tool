// app/(protected)/settings/loading.tsx
// Shown the moment a link to this page is clicked, while the server renders it.

import { SettingsSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return <SettingsSkeleton />;
}
