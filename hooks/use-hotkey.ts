// hooks/use-hotkey.ts
// Global keyboard shortcut. Ignored while the user is typing in a field,
// unless it uses the platform modifier (⌘ on macOS, Ctrl elsewhere).

"use client";

import { useEffect, useRef } from "react";

interface HotkeyOptions {
  /** Require ⌘ (macOS) or Ctrl. Such shortcuts also work inside fields. */
  mod?: boolean;
  enabled?: boolean;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  { mod = false, enabled = true }: HotkeyOptions = {}
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== key.toLowerCase() || event.repeat) return;

      const hasMod = event.metaKey || event.ctrlKey;
      if (mod ? !hasMod : hasMod || event.altKey || isTyping(event.target)) return;

      event.preventDefault();
      handlerRef.current(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, mod, enabled]);
}
