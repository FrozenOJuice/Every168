import { useCallback, useEffect, useState, type RefObject } from "react";
import type { CalendarScrollPosition } from "./calendar-grid";
import type { TimeScaleAnchor } from "./calendar-time-axis";
import {
  HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  timeTickMinutes,
  timeScaleScrollTop,
  type TimeTickMinutes,
  type CalendarView,
} from "./calendar-layout";
export function useCalendarZoom({
  userId,
  view,
  unavailable,
  calendarSurface,
  scrollPositionRef,
}: {
  userId: string;
  view: CalendarView;
  unavailable: boolean;
  calendarSurface: RefObject<HTMLDivElement | null>;
  scrollPositionRef: RefObject<CalendarScrollPosition>;
}) {
  const [savedHourHeight, setSavedHourHeight] = useState(HOUR_HEIGHT);
  const [minimumHourHeight, setMinimumHourHeight] = useState(MIN_HOUR_HEIGHT);
  const hourHeight = Math.max(savedHourHeight, minimumHourHeight);
  const [tickMinutes, setTickMinutes] = useState<TimeTickMinutes>(60);
  const visibleTickMinutes = timeTickMinutes(tickMinutes, hourHeight);
  const changeMinimumHourHeight = useCallback((height: number) => {
    setMinimumHourHeight(Math.max(MIN_HOUR_HEIGHT, height));
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = Number(
          localStorage.getItem(`calendar-hour-height:${userId}`),
        );
        if (
          !Number.isInteger(stored) ||
          stored < MIN_HOUR_HEIGHT ||
          stored > MAX_HOUR_HEIGHT
        )
          return;
        scrollPositionRef.current.top =
          (scrollPositionRef.current.top ?? 0) * (stored / HOUR_HEIGHT);
        setSavedHourHeight(stored);
        const savedTicks = Number(
          localStorage.getItem(`calendar-time-ticks:${userId}`),
        );
        setTickMinutes(
          timeTickMinutes(
            savedTicks === 15 ||
              savedTicks === 30 ||
              savedTicks === 120 ||
              savedTicks === 240
              ? savedTicks
              : 60,
            stored,
          ),
        );
      } catch {
        // Browser storage is optional; the default scale remains usable.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [userId, scrollPositionRef]);
  const changeHourHeight = useCallback(
    (next: number, anchor?: TimeScaleAnchor) => {
      const fitted = next <= minimumHourHeight;
      const stored = fitted ? MIN_HOUR_HEIGHT : next;
      if (stored === savedHourHeight) return;
      const nextTicks = timeTickMinutes(visibleTickMinutes, next);
      scrollPositionRef.current.top = anchor
        ? timeScaleScrollTop(anchor, next, minimumHourHeight)
        : ((scrollPositionRef.current.top ?? 0) * next) / hourHeight;
      setSavedHourHeight(stored);
      setTickMinutes(nextTicks);
      try {
        localStorage.setItem(`calendar-hour-height:${userId}`, String(stored));
        localStorage.setItem(
          `calendar-time-ticks:${userId}`,
          String(nextTicks),
        );
      } catch {
        // Keep the current scale even when browser storage is unavailable.
      }
    },
    [
      scrollPositionRef,
      hourHeight,
      minimumHourHeight,
      savedHourHeight,
      userId,
      visibleTickMinutes,
    ],
  );
  useEffect(() => {
    if (view === "month") return;
    const resetHourSpacing = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "r" ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        unavailable ||
        (event.target instanceof Element &&
          (event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="menu"]',
          ) ||
            (event.target !== document.body &&
              !calendarSurface.current?.contains(event.target))))
      )
        return;
      event.preventDefault();
      changeHourHeight(HOUR_HEIGHT);
    };
    window.addEventListener("keydown", resetHourSpacing);
    return () => window.removeEventListener("keydown", resetHourSpacing);
  }, [view, unavailable, changeHourHeight, calendarSurface]);
  return {
    hourHeight,
    minimumHourHeight,
    visibleTickMinutes,
    changeMinimumHourHeight,
    changeHourHeight,
  };
}
