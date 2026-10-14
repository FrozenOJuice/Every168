"use client";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { FormBusyContext } from "@/components/ui/form";

export function CalendarPlanPopover({
  date,
  recordId,
  title,
  busy: commandBusy = false,
  onBusyChange,
  onClose,
  children,
  container,
}: {
  date?: string;
  recordId?: string;
  title: string;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onClose: () => void;
  children: ReactNode;
  container?: Element | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [formBusy, setFormBusy] = useState(false);
  const busy = formBusy || commandBusy;
  const reportBusy = useCallback(
    (value: boolean) => {
      setFormBusy(value);
      onBusyChange?.(value);
    },
    [onBusyChange],
  );
  const current = useRef({ busy, onClose });
  useLayoutEffect(() => {
    current.current = { busy, onClose };
  });
  useLayoutEffect(() => {
    const panel = ref.current!;
    const opener = document.activeElement;
    function place() {
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
      const topEdge = (viewport?.offsetTop ?? 0) + 12;
      const rightEdge = leftEdge + (viewport?.width ?? innerWidth) - 24;
      const bottomEdge = topEdge + (viewport?.height ?? innerHeight) - 24;
      panel.style.width = `${Math.min(320, rightEdge - leftEdge)}px`;
      panel.style.maxHeight = `${bottomEdge - topEdge}px`;
      const anchors = Array.from(
        document.querySelectorAll<HTMLElement>("[data-calendar-draft]"),
      );
      const records = Array.from(
        document.querySelectorAll<HTMLElement>("[data-calendar-record]"),
      );
      const record = records.find(
        (node) =>
          node.dataset.calendarRecord === recordId &&
          node.getBoundingClientRect().height > 0 &&
          node.getBoundingClientRect().bottom > topEdge &&
          node.getBoundingClientRect().top < bottomEdge,
      );
      const anchor =
        (opener instanceof HTMLElement &&
        opener.isConnected &&
        opener.dataset.calendarRecord === recordId &&
        recordId
          ? opener
          : null) ??
        record ??
        anchors.find((node) => node.dataset.calendarDraft === date) ??
        anchors[0] ??
        (opener instanceof HTMLElement &&
        opener.isConnected &&
        opener.closest(".calendar-record")
          ? opener
          : null) ??
        document.querySelector<HTMLElement>(".calendar-toolbar");
      const bounds = anchor?.getBoundingClientRect();
      const height = panel.getBoundingClientRect().height;
      const width = panel.getBoundingClientRect().width;
      let left = bounds ? bounds.right + 10 : rightEdge - width;
      let top = bounds?.top ?? topEdge;
      if (bounds && left + width > rightEdge) {
        if (bounds.left - width - 10 >= leftEdge)
          left = bounds.left - width - 10;
        else {
          left = leftEdge + (rightEdge - leftEdge - width) / 2;
          top = bounds.bottom + 10;
        }
      }
      panel.style.left = `${Math.max(leftEdge, Math.min(left, rightEdge - width))}px`;
      panel.style.top = `${Math.max(topEdge, Math.min(top, bottomEdge - height))}px`;
      panel.style.visibility = "visible";
    }
    place();
    (
      panel.querySelector<HTMLInputElement>('input[name="title"]') ??
      panel.querySelector<HTMLInputElement>("form input")
    )?.focus({ preventScroll: true });
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    const grid = document.querySelector(".calendar-grid");
    if (grid) observer.observe(grid);
    // Time edits move the draft without resizing the editor.
    const mutation = new MutationObserver(place);
    document
      .querySelectorAll(".calendar-grid, .calendar-month")
      .forEach((node) =>
        mutation.observe(node, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "data-calendar-draft"],
        }),
      );
    let dismissOnClick = false;
    function outside(event: Event) {
      if (event.type === "pointerdown") dismissOnClick = false;
      if (!(event.target instanceof Node) || panel.contains(event.target))
        return;
      if (event.type === "pointerdown") dismissOnClick = true;
      // Ignore the release click from the gesture that opened this panel.
      if (!dismissOnClick && !current.current.busy) return;
      // Keep the panel mounted through click so dismissal cannot select or
      // start dragging the calendar target underneath it.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!current.current.busy && event.type === "click")
        current.current.onClose();
    }
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!current.current.busy) current.current.onClose();
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("click", outside, true);
    document.addEventListener("keydown", key, true);
    document.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      observer.disconnect();
      mutation.disconnect();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("click", outside, true);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [date, recordId]);
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="calendar-plan-popover"
    >
      <div className="row between">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <FormBusyContext.Provider value={reportBusy}>
        {children}
      </FormBusyContext.Provider>
    </div>,
    container ?? document.body,
  );
}
