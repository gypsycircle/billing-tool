// hooks/use-unsaved-changes.ts
// Asks the browser to confirm before closing or reloading a page with unsaved edits.

"use client";

import { useEffect } from "react";

export function useUnsavedChanges(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);
}
