"use client";
import { useLayoutEffect } from "react";
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
  useLayoutEffect(() => {
    if (!dirty) return;
    const currentHref = window.location.href;
    const traversal = (event: NavigateEvent) => {
      if (
        event.navigationType !== "traverse" ||
        !event.cancelable ||
        event.destination.url === currentHref
      )
        return;
      if (blocked || !confirm(message)) event.preventDefault();
    };
    const currentState = window.history.state;
    const pop = (event: PopStateEvent) => {
      if (window.location.href === currentHref) return;
      if (blocked || !confirm(message)) {
        event.stopImmediatePropagation();
        // Restore the current entry before the router handles a declined Back/Forward.
        window.history.pushState(currentState, "", currentHref);
      }
    };
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
        !(
          anchor.hash &&
          anchor.origin === window.location.origin &&
          anchor.pathname === window.location.pathname &&
          anchor.search === window.location.search
        ) &&
        (blocked || !confirm(message))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    if (window.navigation)
      window.navigation.addEventListener("navigate", traversal);
    else window.addEventListener("popstate", pop, true);
    document.addEventListener("click", navigate, true);
    document.addEventListener(navigationEvent, beforeNavigation);
    return () => {
      window.removeEventListener("beforeunload", unload);
      if (window.navigation)
        window.navigation.removeEventListener("navigate", traversal);
      else window.removeEventListener("popstate", pop, true);
      document.removeEventListener("click", navigate, true);
      document.removeEventListener(navigationEvent, beforeNavigation);
    };
  }, [dirty, message, blocked]);
}
