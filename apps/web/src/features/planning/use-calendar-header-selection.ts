import {
  useLayoutEffect,
  useRef,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useCalendarInteractions } from "./calendar-interactions";
export function useCalendarHeaderSelection(
  scroll: RefObject<HTMLDivElement | null>,
  onSelectDay: (date: string, mode?: "replace" | "toggle" | "extend") => void,
  onSelectRange: (first: string, last: string) => void,
) {
  const interaction = useCalendarInteractions();
  const suppressHeaderClick = useRef(false);
  const stopHeaderDrag = useRef<(() => void) | null>(null);
  useLayoutEffect(() => () => stopHeaderDrag.current?.(), []);
  function startHeaderRange(
    event: ReactPointerEvent<HTMLButtonElement>,
    first: string,
  ) {
    if (
      event.button !== 0 ||
      event.pointerType !== "mouse" ||
      interaction?.busy
    )
      return;
    stopHeaderDrag.current?.();
    suppressHeaderClick.current = true;

    onSelectDay(first, interaction?.daySelectionMode(event) ?? "replace");
    const pointer = event.pointerId;
    const x = event.clientX;
    const y = event.clientY;
    let pointerX = x;
    let pointerY = y;
    let last = first;
    let selected = "";
    let moved = false;
    let frame = 0;
    const cleanup = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      stopHeaderDrag.current = null;
    };
    const updateTarget = (targetX: number, targetY: number) => {
      const heading = document
        .elementFromPoint(targetX, targetY)
        ?.closest<HTMLElement>(".grid-day-heading[data-date]");
      if (!heading?.dataset.date) return;
      last = heading.dataset.date;
      if (moved && selected !== last) {
        selected = last;
        onSelectRange(first, last);
      }
    };
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      pointerX = next.clientX;
      pointerY = next.clientY;
      if (!moved && Math.hypot(pointerX - x, pointerY - y) > 5) moved = true;
      if (moved) next.preventDefault();
      updateTarget(pointerX, pointerY);
    };
    const tick = () => {
      const viewport = scroll.current;
      const header = viewport?.querySelector<HTMLElement>(
        ".calendar-grid-head",
      );
      if (moved && viewport && header) {
        const bounds = viewport.getBoundingClientRect();
        const headerBounds = header.getBoundingClientRect();
        if (
          pointerY >= headerBounds.top &&
          pointerY <= headerBounds.bottom &&
          pointerX >= bounds.left &&
          pointerX <= bounds.right
        ) {
          const delta =
            pointerX > bounds.right - 35
              ? 14
              : pointerX < bounds.left + 85
                ? -14
                : 0;
          if (delta) {
            viewport.scrollLeft += delta;
            updateTarget(pointerX, pointerY);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      cleanup();
      if (moved) onSelectRange(first, last);
      window.setTimeout(() => {
        suppressHeaderClick.current = false;
      }, 0);
    };
    const cancel = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      cleanup();
      window.setTimeout(() => {
        suppressHeaderClick.current = false;
      }, 0);
    };
    stopHeaderDrag.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    frame = requestAnimationFrame(tick);
  }
  return {
    startHeaderRange,
    isHeaderClickSuppressed: () => suppressHeaderClick.current,
    consumeHeaderClick: () => {
      const suppressed = suppressHeaderClick.current;
      suppressHeaderClick.current = false;
      return suppressed;
    },
  };
}
