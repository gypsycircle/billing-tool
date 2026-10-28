import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Security headers applied to all routes. The Content-Security-Policy is
 * NOT set here: proxy.ts sends a per-request nonce CSP.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options",   value: "nosniff" },
  { key: "X-Frame-Options",          value: "DENY" },
  { key: "Referrer-Policy",          value: "same-origin" },
  { key: "X-Robots-Tag",             value: "noindex, nofollow" },
  { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // HSTS — production only (Vercel also sends it for every HTTPS response)
  ...(!isDev
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

/** Pages and API responses contain private data: never cache them anywhere. */
const noStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
];

// No cacheComponents / partialPrefetching: a nonce CSP requires every page to
// be rendered per request (see docs/phase-2r-security-plan.md §1).
const nextConfig: NextConfig = {
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  // The app has no next/image usage: switch the /_next/image optimiser off so
  // it is not an exposed endpoint (it is also outside the proxy's session gate).
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The bill's fonts and images live in private-templates/ (never public/), so
  // they must be bundled into every route that reads them: the PDF itself, and
  // the saves + detail page that check a booking fits the bill.
  // Keys are picomatch globs on the route path, so [ and ] must be escaped.
  outputFileTracingIncludes: Object.fromEntries(
    ["/api/bookings/\\[id\\]/pdf", "/api/bookings/\\[id\\]", "/api/bookings", "/bookings/\\[id\\]"].map((route) => [
      route,
      ["./private-templates/fonts/latin/*.ttf", "./private-templates/images/*.png"],
    ])
  ),
  // The access page lives at /. Old /access links (and their ?next=) still
  // work: redirects run before proxy.ts and keep the query string.
  async redirects() {
    return [{ source: "/access", destination: "/", permanent: false }];
  },
  async headers() {
    return [
      // Security headers on every route
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // No-store on every page and API route (framework assets excluded)
      {
        source: "/((?!_next/).*)",
        headers: noStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
