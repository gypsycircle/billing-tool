// app/sw.js/route.ts
// GET /sw.js — the PWA's service worker. It does one thing: when a page
// can't load because the network is down, it shows a small "You're offline"
// screen instead of the browser's error.
//
// It caches NOTHING: bookings are private finance data, so no page, API
// answer or PDF is ever kept on the device (pages stay no-store). API calls,
// assets and the PDF are never intercepted. Served without a session
// (proxy.ts) because it holds no data. Registered by
// components/pwa/service-worker.tsx in production only.

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#285860">
<title>Offline · GypsyCircle Billing</title>
<style>
  :root { color-scheme: light dark; --paper: #f8f5ee; --ink: #1f2326; --muted: #6b6f72; --brand: #285860; }
  @media (prefers-color-scheme: dark) { :root { --paper: #16191d; --ink: #ece8df; --muted: #9a9ea3; --brand: #7fb8bf; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
         background: var(--paper); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 22rem; text-align: center; }
  .mark { width: 56px; height: 56px; margin: 0 auto 20px; border-radius: 50%; background: var(--brand); }
  p.eyebrow { margin: 0 0 6px; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  h1 { margin: 0 0 8px; font: 600 28px/1.2 Georgia, "Times New Roman", serif; }
  p { margin: 0 0 24px; color: var(--muted); }
  a { display: inline-block; padding: 10px 20px; border-radius: 8px; background: var(--brand); color: var(--paper);
      text-decoration: none; font-weight: 500; }
</style>
</head>
<body>
<main>
  <div class="mark" aria-hidden="true"></div>
  <p class="eyebrow">GypsyCircle Billing</p>
  <h1>You're offline</h1>
  <p>Bookings aren't stored on this device. Reconnect to the internet and try again.</p>
  <a href="">Try again</a>
</main>
</body>
</html>`;

const SERVICE_WORKER = `// GypsyCircle Billing — offline screen only; caches nothing (see app/sw.js/route.ts)
const OFFLINE_PAGE = ${JSON.stringify(OFFLINE_PAGE)};

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Start each page's request while the worker boots, so it never slows a load
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  // Only page loads; everything else (API, assets, PDF, RSC) goes straight to the network
  if (event.request.mode !== "navigate") return;
  event.respondWith((async () => {
    try {
      return (await event.preloadResponse) || (await fetch(event.request));
    } catch {
      return new Response(OFFLINE_PAGE, {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        },
      });
    }
  })());
});
`;

export function GET(): Response {
  return new Response(SERVICE_WORKER, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Browsers check for a new worker on every visit
      "Cache-Control": "no-cache",
    },
  });
}
