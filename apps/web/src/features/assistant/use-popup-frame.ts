"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  clampPopupFrame,
  resizePopupFrame,
  type PopupFrame,
  type ResizeEdge,
} from "./assistant-popup-frame";

const viewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});
const viewportSnapshot = () => `${window.innerWidth}:${window.innerHeight}`;
const serverSnapshot = () => "0:0";
function subscribe(change: () => void) {
  window.addEventListener("resize", change);
  return () => window.removeEventListener("resize", change);
}
type Gesture = {
  pointer: number;
  target: HTMLElement;
  operation: "move" | ResizeEdge;
  startX: number;
  startY: number;
  frame: PopupFrame;
  previous: PopupFrame | null;
};

export function usePopupFrame(
  dialog: RefObject<HTMLDialogElement | null>,
  enabled: boolean,
  saved: PopupFrame | null,
  onChange: (frame: PopupFrame | null) => void,
) {
  const size = useSyncExternalStore(
    subscribe,
    viewportSnapshot,
    serverSnapshot,
  );
  const [operation, setOperation] = useState<Gesture["operation"] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const change = useRef(onChange);
  const hintId = useId();
  useLayoutEffect(() => {
    change.current = onChange;
  });
  const finish = (cancel: boolean) => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    if (cancel) change.current(current.previous);
    if (current.target.hasPointerCapture(current.pointer))
      current.target.releasePointerCapture(current.pointer);
    setOperation(null);
  };
  useLayoutEffect(() => {
    const stop = () => {
      const current = gesture.current;
      if (!current) return;
      gesture.current = null;
      change.current(current.previous);
      if (current.target.hasPointerCapture(current.pointer))
        current.target.releasePointerCapture(current.pointer);
      setOperation(null);
    };
    window.addEventListener("resize", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("resize", stop);
      window.removeEventListener("blur", stop);
      const current = gesture.current;
      if (current) {
        gesture.current = null;
        change.current(current.previous);
        if (current.target.hasPointerCapture(current.pointer))
          current.target.releasePointerCapture(current.pointer);
      }
    };
  }, []);
  const readFrame = (): PopupFrame | null => {
    const box = dialog.current?.getBoundingClientRect();
    return box
      ? { x: box.x, y: box.y, width: box.width, height: box.height }
      : null;
  };
  const start = (
    event: PointerEvent<HTMLElement>,
    action: Gesture["operation"],
  ) => {
    if (!enabled || event.button !== 0 || !event.isPrimary || gesture.current)
      return;
    const frame = readFrame();
    if (!frame) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      pointer: event.pointerId,
      target: event.currentTarget,
      operation: action,
      startX: event.clientX,
      startY: event.clientY,
      frame,
      previous: saved,
    };
    setOperation(action);
  };
  const onKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    action: "move" | "resize",
  ) => {
    if (!enabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 40 : 10;
    const dx =
      event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy =
      event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    const frame = readFrame();
    if (!frame) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(
      action === "move"
        ? clampPopupFrame(
            { ...frame, x: frame.x + dx, y: frame.y + dy },
            viewport(),
          )
        : resizePopupFrame(frame, "se", dx, dy, viewport()),
    );
  };
  const [width, height] = size.split(":").map(Number);
  const fitted =
    enabled && saved
      ? clampPopupFrame(saved, { width: width!, height: height! })
      : null;
  return {
    hintId,
    operation,
    style: fitted
      ? ({
          inset: "auto",
          left: fitted.x,
          top: fitted.y,
          width: fitted.width,
          height: fitted.height,
        } as CSSProperties)
      : undefined,
    startResize: (event: PointerEvent<HTMLElement>, edge: ResizeEdge) =>
      start(event, edge),
    moveKeys: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, "move"),
    resizeKeys: (event: KeyboardEvent<HTMLElement>) =>
      onKeyDown(event, "resize"),
    headerPointerDown: (event: PointerEvent<HTMLElement>) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("a, button") &&
        !target.closest("[data-popup-move]")
      )
        return;
      start(event, "move");
    },
    dialogEvents: {
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const current = gesture.current;
        if (!current || current.pointer !== event.pointerId) return;
        const dx = event.clientX - current.startX,
          dy = event.clientY - current.startY;
        change.current(
          current.operation === "move"
            ? clampPopupFrame(
                {
                  ...current.frame,
                  x: current.frame.x + dx,
                  y: current.frame.y + dy,
                },
                viewport(),
              )
            : resizePopupFrame(
                current.frame,
                current.operation,
                dx,
                dy,
                viewport(),
              ),
        );
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        if (gesture.current?.pointer === event.pointerId) finish(false);
      },
      onPointerCancel: (event: PointerEvent<HTMLElement>) => {
        if (gesture.current?.pointer === event.pointerId) finish(true);
      },
      onLostPointerCapture: () => finish(true),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape" && gesture.current) {
          event.preventDefault();
          event.stopPropagation();
          finish(true);
        }
      },
    },
  };
}
