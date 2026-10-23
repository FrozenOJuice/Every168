"use client";
import { useEffect } from "react";
export function useUnsavedChanges(
  dirty: boolean,
  message = "Leave this workout without saving your changes?",
) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    const navigate = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        anchor instanceof HTMLAnchorElement &&
        anchor.href !== window.location.href &&
        !anchor.hash &&
        !confirm(message)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, message]);
}
