'use client'

import { useEffect, useRef } from "react";

/**
 * Traps focus within the container element when `active` is true.
 *
 * On mount/modal-open:
 *  - Saves `document.activeElement` so it can be restored on teardown.
 *  - Focuses the first focusable element inside the container.
 *
 * On Tab/Shift+Tab:
 *  - Cycles focus through all focusable elements in the container.
 *
 * On unmount/modal-close:
 *  - Removes the keydown listener.
 *  - Restores focus to the previously active element.
 */
export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const previouslyFocused = document.activeElement as HTMLElement;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = () =>
      ref.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [];

    // Focus first focusable element
    const focusables = getFocusable();
    if (focusables.length > 0) focusables[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [active]);

  return ref;
}
