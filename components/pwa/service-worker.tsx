// components/pwa/service-worker.tsx
// Registers the PWA's service worker (/sw.js, the offline screen) in
// production. In development it removes any worker left from a production
// run on localhost, so hot reload is never served by it.

"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the app works the same without it, minus the offline screen
    });
  }, []);

  return null;
}
