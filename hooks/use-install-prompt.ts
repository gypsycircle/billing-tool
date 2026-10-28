// hooks/use-install-prompt.ts
// "Install app" for the PWA. Chrome and Edge offer installing through a
// `beforeinstallprompt` event; it is kept here so a menu item can show the
// browser's install dialog later. Safari has no such event (iPhone users use
// Share → Add to Home Screen), so `canInstall` stays false there, and also once
// the app is installed or already running as one.

"use client";

import { useCallback, useEffect, useState } from "react";

/** Chrome's install event (not in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own menu item instead of the browser's mini-bar
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null); // the event can only be used once
  }, [event]);

  return { canInstall: event !== null, install };
}
