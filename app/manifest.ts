// app/manifest.ts
// The web app manifest (/manifest.webmanifest): makes the app installable
// ("Install app" in Chrome/Edge, "Add to Home Screen" on iPhone). proxy.ts
// serves it without a session, since browsers fetch it without cookies; it
// holds no data. Icons are static imports (/_next/static/…), also outside
// the session gate. Rebuild them with scripts/pdf/build_assets.py --icons.

import type { MetadataRoute } from "next";
import icon192 from "@/components/brand/app-icons/icon-192.png";
import icon512 from "@/components/brand/app-icons/icon-512.png";
import iconMaskable from "@/components/brand/app-icons/icon-maskable-512.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GypsyCircle Billing",
    short_name: "GC Billing",
    description: "Private billing and invoice management tool for GypsyCircle.",
    // Signed-out users are sent on to the access page by proxy.ts
    start_url: "/bookings",
    scope: "/",
    display: "standalone",
    background_color: "#f8f5ee", // the light theme's paper
    theme_color: "#285860", // the logo teal
    icons: [
      { src: icon192.src, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512.src, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: iconMaskable.src, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
