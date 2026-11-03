// hooks/use-shortcut.ts
// A single-key shortcut (SHORTCUTS) that runs an action: new booking, add a
// team member, download the bill… It waits while any dialog or menu is open,
// so it never acts behind one or stacks one dialog on another, and (like
// every hotkey) while the user is typing.

"use client";

import { useHotkey } from "./use-hotkey";

/** A dialog or menu is showing (a closed one can linger in the page for a moment, empty: that doesn't count). */
function overlayOpen(): boolean {
  return [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')].some(
    (element) => element.getBoundingClientRect().height > 0
  );
}

export function useShortcut(key: string, action: () => void, { enabled = true }: { enabled?: boolean } = {}): void {
  useHotkey(
    key,
    () => {
      if (!overlayOpen()) action();
    },
    { enabled }
  );
}
