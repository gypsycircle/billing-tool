// components/shared/icon-action.tsx
// A button that is only an icon: its tooltip says what it does, and screen
// readers get `label`. With `pending`, it shows a spinner and waits.

"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function IconAction({
  label,
  tooltip = label,
  variant = "ghost",
  size = "icon-sm",
  pending,
  onClick,
  className,
  children,
}: {
  /** What it does, for screen readers. */
  label: string;
  /** Shorter wording for the tooltip, when `label` needs more detail. */
  tooltip?: string;
  variant?: "ghost" | "outline";
  size?: "icon-sm" | "icon-lg";
  pending?: boolean;
  onClick: () => void;
  className?: string;
  /** The icon. */
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant={variant} size={size} aria-label={label} disabled={pending} onClick={onClick} className={className} />}>
        {pending ? <Loader2 className="animate-spin" /> : children}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
