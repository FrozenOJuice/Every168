import { useId, useRef } from "react";
import {
  HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  type TimeTickMinutes,
} from "./calendar-layout";

function clampHourHeight(value: number, minimum: number) {
  return Math.max(minimum, Math.min(MAX_HOUR_HEIGHT, value));
}

export type TimeScaleAnchor = {
  y: number;
  height: number;
  top: number;
};

export function CalendarTimeAxis({
  hourHeight,
  minimumHourHeight,
  tickMinutes,
  onChange,
  onFinish,
  clockChange,
}: {
  hourHeight: number;
  minimumHourHeight: number;
  tickMinutes: TimeTickMinutes;
  onChange: (height: number, anchor?: TimeScaleAnchor) => void;
  onFinish: () => void;
  clockChange: boolean;
}) {
  const hintId = useId();
  const drag = useRef<{
    pointerId: number;
    y: number;
    height: number;
    anchor: TimeScaleAnchor;
  } | null>(null);
  if (clockChange) return <div className="hour-axis" aria-hidden="true" />;
  return (
    <div
      className="hour-axis"
      role="slider"
      tabIndex={0}
      aria-label="Hour spacing"
      aria-orientation="vertical"
      aria-valuemin={minimumHourHeight}
      aria-valuemax={Math.max(MAX_HOUR_HEIGHT, minimumHourHeight)}
      aria-valuenow={hourHeight}
      aria-valuetext={`${Math.round(hourHeight * 10) / 10} pixels per hour, labels every ${tickMinutes} minutes`}
      aria-describedby={hintId}
      data-tick-minutes={tickMinutes}
      title="Drag to adjust hour spacing. Double-click to reset."
      onPointerDown={(event) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        const scroller =
          event.currentTarget.closest<HTMLElement>(".calendar-scroll");
        drag.current = {
          pointerId: event.pointerId,
          y: event.clientY,
          height: hourHeight,
          anchor: {
            y: event.clientY - (scroller?.getBoundingClientRect().top ?? 0),
            height: hourHeight,
            top: scroller?.scrollTop ?? 0,
          },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        onChange(
          clampHourHeight(
            Math.round(current.height + (event.clientY - current.y) / 2.5),
            minimumHourHeight,
          ),
          current.anchor,
        );
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId) {
          drag.current = null;
          onFinish();
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
        onFinish();
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        onFinish();
      }}
      onDoubleClick={() => onChange(HOUR_HEIGHT)}
      onKeyDown={(event) => {
        const change =
          event.key === "ArrowDown" || event.key === "ArrowRight"
            ? 4
            : event.key === "ArrowUp" || event.key === "ArrowLeft"
              ? -4
              : event.key === "PageDown"
                ? 12
                : event.key === "PageUp"
                  ? -12
                  : 0;
        if (change) {
          event.preventDefault();
          onChange(clampHourHeight(hourHeight + change, minimumHourHeight));
        } else if (event.key.toLowerCase() === "r") {
          event.preventDefault();
          onChange(HOUR_HEIGHT);
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(minimumHourHeight);
        } else if (event.key === "End") {
          event.preventDefault();
          onChange(MAX_HOUR_HEIGHT);
        }
      }}
    >
      <span id={hintId} className="sr-only">
        Drag down to spread hours apart or up to compress them. Double-click or
        press R to reset.
      </span>
      {Array.from({ length: 1440 / tickMinutes }, (_, index) => {
        const minute = index * tickMinutes;
        return (
          <span
            key={minute}
            className={minute === 0 ? "hour-axis-start" : undefined}
            aria-hidden="true"
            style={{ top: (minute / 60) * hourHeight }}
          >
            {String(Math.floor(minute / 60)).padStart(2, "0")}:
            {String(minute % 60).padStart(2, "0")}
          </span>
        );
      })}
      <span className="hour-axis-end" aria-hidden="true">
        24:00
      </span>
    </div>
  );
}
