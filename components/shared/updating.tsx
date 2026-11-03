// components/shared/updating.tsx
// Beside a control whose change is loading: the page will update in a moment.

import { Loader2 } from "lucide-react";

export function Updating() {
  return <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />;
}
