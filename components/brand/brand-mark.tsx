// components/brand/brand-mark.tsx
// The GypsyCircle logo, drawn as a CSS mask so it takes the current text
// colour: teal on paper, paper on the ink panel, and correct in dark mode.
// The PNG is imported statically, so it is served from /_next/static —
// outside the proxy's session gate (the access page needs it).

import { cn } from "@/lib/utils";
import logo from "./gypsycircle-logo.png";

export function BrandMark({
  className,
  label = "GypsyCircle",
}: {
  className?: string;
  /** Accessible name; pass "" when a visible name sits next to the mark. */
  label?: string;
}) {
  const mask = `url(${logo.src})`;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        aspectRatio: `${logo.width} / ${logo.height}`,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "left center",
        WebkitMaskPosition: "left center",
      }}
    />
  );
}
