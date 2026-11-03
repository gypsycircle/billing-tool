// components/shared/button-kbd.tsx
// A keyboard shortcut shown on a primary button ("New booking B"), from small
// screens up.

import { Kbd } from "@/components/ui/kbd";

export function ButtonKbd({ children }: { children: React.ReactNode }) {
  return <Kbd className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex">{children}</Kbd>;
}
