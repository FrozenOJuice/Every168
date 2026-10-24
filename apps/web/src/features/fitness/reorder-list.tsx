"use client";
import { GripVertical } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { moveTo } from "./strength-draft";

/** Preview a handle drag locally; only a completed drop changes the draft. */
export function useReorderList<T>(
  items: T[],
  onChange: (items: T[]) => void,
  disabled: boolean,
) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({ items, onChange, disabled });
  const cleanup = useRef<(() => void) | null>(null);
  const instructions = useId();
  const [drag, setDrag] = useState<{
    from: number;
    to: number;
    delta: number;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useLayoutEffect(() => {
    latest.current = { items, onChange, disabled };
  }, [items, onChange, disabled]);
  useEffect(() => () => cleanup.current?.(), []);

  const start = (
    event: PointerEvent<HTMLButtonElement>,
    from: number,
    label: string,
  ) => {
    if (!event.isPrimary || event.button !== 0 || disabled || items.length < 2)
      return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    cleanup.current?.();
    const handle = event.currentTarget;
    const snapshot = latest.current.items;
    const rows = Array.from(root.current?.children ?? []).filter((node) =>
      node.hasAttribute("data-reorder-item"),
    );
    const rects = rows.map((row) => row.getBoundingClientRect());
    if (rects.length !== snapshot.length) return;
    let scroller: HTMLElement | null = root.current;
    while (
      scroller &&
      (!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) ||
        scroller.scrollHeight <= scroller.clientHeight)
    )
      scroller = scroller.parentElement;
    const initialScroll = scroller?.scrollTop ?? window.scrollY;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let y = startY,
      to = from,
      active = false,
      frame = 0;
    const update = () => {
      const scroll = (scroller?.scrollTop ?? window.scrollY) - initialScroll;
      const position = y + scroll;
      to = rects.reduce(
        (best, rect, index) =>
          Math.abs(position - (rect.top + rect.height / 2)) <
          Math.abs(position - (rects[best]!.top + rects[best]!.height / 2))
            ? index
            : best,
        from,
      );
      if (active) setDrag({ from, to, delta: y - startY + scroll });
    };
    const tick = () => {
      if (active) {
        const box = scroller?.getBoundingClientRect();
        const top = Math.max(0, box?.top ?? 0),
          bottom = Math.min(
            window.innerHeight,
            box?.bottom ?? window.innerHeight,
          );
        const step = y < top + 36 ? -8 : y > bottom - 36 ? 8 : 0;
        if (step) {
          if (scroller) scroller.scrollTop += step;
          else window.scrollBy(0, step);
          update();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      y = next.clientY;
      if (Math.abs(y - startY) >= 5) active = true;
      update();
    };
    const finish = (commit: boolean) => {
      cleanup.current?.();
      cleanup.current = null;
      setDrag(null);
      if (
        commit &&
        active &&
        !latest.current.disabled &&
        latest.current.items === snapshot &&
        from !== to
      ) {
        latest.current.onChange(moveTo(snapshot, from, to));
        setAnnouncement(
          `${label} moved to position ${to + 1} of ${snapshot.length}.`,
        );
      } else if (!commit) setAnnouncement("Reordering cancelled.");
      requestAnimationFrame(() => {
        if (handle.isConnected) handle.focus({ preventScroll: true });
      });
    };
    const up = (next: globalThis.PointerEvent) => {
      if (next.pointerId === pointerId) {
        update();
        finish(true);
      }
    };
    const cancel = () => finish(false);
    const key = (next: KeyboardEvent) => {
      if (next.key === "Escape" || next.key === "Tab") {
        next.preventDefault();
        cancel();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    cleanup.current = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
    };
    frame = requestAnimationFrame(tick);
  };
  return {
    root,
    feedback: (
      <>
        <span id={instructions} className="sr-only">
          Drag to reorder, or use Up and Down arrow keys on the handle. Escape
          cancels a drag.
        </span>
        <span className="sr-only" role="status">
          {announcement}
        </span>
      </>
    ),
    rowProps: (index: number) => ({
      "data-reorder-item": true,
      className:
        drag?.from === index
          ? "fitness-sort-source"
          : drag?.to === index
            ? `fitness-sort-target ${drag.from < index ? "after" : "before"}`
            : undefined,
      style:
        drag?.from === index
          ? { transform: `translateY(${drag.delta}px)` }
          : undefined,
    }),
    handle: (index: number, label: string, content?: ReactNode) => (
      <button
        type="button"
        className={`icon-button fitness-reorder-handle${content !== undefined ? " fitness-set-number" : ""}`}
        aria-label={`Reorder ${label}`}
        aria-describedby={instructions}
        title="Drag to reorder · Up/Down keys"
        disabled={disabled || items.length < 2}
        onPointerDown={(event) => start(event, index, label)}
        onKeyDown={(event) => {
          if (
            disabled ||
            drag ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            !["ArrowUp", "ArrowDown"].includes(event.key)
          )
            return;
          event.preventDefault();
          const to = index + (event.key === "ArrowUp" ? -1 : 1);
          const next = moveTo(items, index, to);
          if (next === items) return;
          const handle = event.currentTarget;
          onChange(next);
          setAnnouncement(
            `${label} moved to position ${to + 1} of ${items.length}.`,
          );
          requestAnimationFrame(() => {
            if (handle.isConnected) handle.focus({ preventScroll: true });
          });
        }}
      >
        {content ?? <GripVertical size={18} aria-hidden="true" />}
      </button>
    ),
  };
}
