"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

/** Shared, noninteractive action tooltip. The button keeps its own accessible name. */
export function TooltipButton({
  tooltip,
  children,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onClick,
  "aria-describedby": describedBy,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  tooltip: string;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const show = () => {
    setHost(button.current?.closest("dialog") ?? document.body);
    setOpen(true);
  };
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const close = () => {
    cancel();
    setOpen(false);
    setPosition(null);
  };
  const leave = () => {
    cancel();
    if (!button.current?.matches(":focus-visible"))
      timer.current = setTimeout(close, 120);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!button.current || !tip.current) return;
      const anchor = button.current.getBoundingClientRect();
      const box = tip.current.getBoundingClientRect();
      const above = anchor.top - box.height - 8;
      setPosition({
        left: Math.max(
          8,
          Math.min(
            innerWidth - box.width - 8,
            anchor.left + (anchor.width - box.width) / 2,
          ),
        ),
        top: Math.max(
          8,
          Math.min(
            innerHeight - box.height - 8,
            above >= 8 ? above : anchor.bottom + 8,
          ),
        ),
      });
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (timer.current) clearTimeout(timer.current);
        setOpen(false);
        setPosition(null);
        event.stopPropagation();
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", escape, true);
    };
  }, [open, tooltip]);
  return (
    <>
      <button
        {...props}
        ref={button}
        aria-describedby={
          [describedBy, open ? id : undefined].filter(Boolean).join(" ") ||
          undefined
        }
        onPointerEnter={(event) => {
          cancel();
          if (event.pointerType !== "touch")
            timer.current = setTimeout(show, 300);
          onPointerEnter?.(event);
        }}
        onPointerLeave={(event) => {
          leave();
          onPointerLeave?.(event);
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) {
            cancel();
            show();
          }
          onFocus?.(event);
        }}
        onBlur={(event) => {
          close();
          onBlur?.(event);
        }}
        onClick={(event) => {
          close();
          onClick?.(event);
        }}
      >
        {children}
      </button>
      {open &&
        host &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            className="action-tooltip"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
            onPointerEnter={cancel}
            onPointerLeave={leave}
          >
            {tooltip}
          </div>,
          host,
        )}
    </>
  );
}
