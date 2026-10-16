"use client";
import { useEffect, type RefObject } from "react";
// Dismiss against the interactive field and popup, not surrounding layout space.
export function useSearchDismissal({
  root,
  field,
  popup,
  trigger,
  setOpen,
}: {
  root: RefObject<HTMLElement | null>;
  field: RefObject<HTMLInputElement | null>;
  popup: RefObject<HTMLElement | null>;
  trigger?: RefObject<HTMLElement | null>;
  setOpen: (open: boolean) => void;
}) {
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        field.current?.contains(target) ||
        popup.current?.contains(target) ||
        trigger?.current?.contains(target)
      )
        return;
      if (
        Array.from(field.current?.labels ?? []).some((label) =>
          label.contains(target),
        )
      )
        return;
      setOpen(false);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && root.current?.contains(focused))
        focused.blur();
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [root, field, popup, trigger, setOpen]);
}
