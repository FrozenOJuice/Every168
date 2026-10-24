"use client";
import { useEffect } from "react";
const navigationEvent = "168hours:before-navigation";
export function canNavigateAway() {
  return document.dispatchEvent(
    new Event(navigationEvent, { cancelable: true }),
  );
}
export function useUnsavedChanges(
  dirty: boolean,
  message = "Leave this workout without saving your changes?",
  blocked = false,
) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    const beforeNavigation = (event: Event) => {
      if (!event.defaultPrevented && (blocked || !confirm(message)))
        event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        anchor instanceof HTMLAnchorElement &&
        anchor.href !== window.location.href &&
        !anchor.hash &&
        (blocked || !confirm(message))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    document.addEventListener(navigationEvent, beforeNavigation);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
      document.removeEventListener(navigationEvent, beforeNavigation);
    };
  }, [dirty, message, blocked]);
}
