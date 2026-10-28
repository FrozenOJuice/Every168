"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function SessionTimePicker({
  label = "Choose start time",
  value,
  anchor,
  onSelect,
  onClose,
}: {
  label?: string;
  value: string;
  anchor: HTMLButtonElement;
  onSelect: (time: string) => void;
  onClose: () => void;
}) {
  const parts = /^(\d{2}):(\d{2})$/.exec(value);
  const [hour, setHour] = useState(
    parts ? String(Number(parts[1]) % 12 || 12) : "12",
  );
  const [minute, setMinute] = useState(parts?.[2] ?? "00");
  const [period, setPeriod] = useState(
    Number(parts?.[1] ?? 0) >= 12 ? "PM" : "AM",
  );
  const panel = useRef<HTMLDivElement>(null);
  function closeAndFocus() {
    onClose();
    anchor.focus({ preventScroll: true });
  }
  function select() {
    onSelect(
      `${String((Number(hour) % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${minute.padStart(2, "0")}`,
    );
    closeAndFocus();
  }
  useLayoutEffect(() => {
    const element = panel.current!;
    function position() {
      const rect = anchor.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - bounds.width - 8))}px`;
      const below = rect.bottom + 8;
      const above = rect.top - bounds.height - 8;
      const top =
        below + bounds.height <= window.innerHeight - 8
          ? below
          : above >= 8
            ? above
            : below;
      element.style.top = `${Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8))}px`;
    }
    position();
    element
      .querySelector<HTMLElement>('[role="listbox"]')
      ?.focus({ preventScroll: true });
    function outside(event: PointerEvent) {
      if (
        !element.contains(event.target as Node) &&
        !anchor.contains(event.target as Node)
      )
        onClose();
    }
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div
      ref={panel}
      className="fitness-time-picker"
      role="dialog"
      aria-label={label}
      aria-modal="false"
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget) &&
          event.relatedTarget !== anchor
        )
          onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeAndFocus();
        }
      }}
    >
      <div className="fitness-time-wheels">
        <TimeWheel
          label="Hour"
          options={hours}
          value={hour}
          onChange={setHour}
        />
        <TimeWheel
          label="Minute"
          options={minutes}
          value={minute}
          onChange={setMinute}
        />
        <TimeWheel
          label="AM/PM"
          options={periods}
          value={period}
          onChange={setPeriod}
        />
      </div>
      <button type="button" className="button primary" onClick={select}>
        Set time
      </button>
    </div>,
    anchor.closest("main") ?? document.body,
  );
}

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
const minutes = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const periods = ["AM", "PM"];
const rowHeight = 44;

function TimeWheel({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const initial = useRef(value);
  useLayoutEffect(() => {
    if (list.current)
      list.current.scrollTop =
        Math.max(0, options.indexOf(initial.current)) * rowHeight;
  }, [options]);
  function choose(index: number) {
    const next = Math.max(0, Math.min(options.length - 1, index));
    onChange(options[next]!);
    list.current?.scrollTo({ top: next * rowHeight, behavior: "instant" });
    list.current?.focus({ preventScroll: true });
  }
  return (
    <div className="fitness-time-wheel">
      <span id={`${id}-label`}>{label}</span>
      <div className="fitness-time-wheel-frame">
        <div
          ref={list}
          role="listbox"
          tabIndex={0}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-${options.indexOf(value)}`}
          className="fitness-time-wheel-list"
          onScroll={(event) => {
            const index = Math.max(
              0,
              Math.min(
                options.length - 1,
                Math.round(event.currentTarget.scrollTop / rowHeight),
              ),
            );
            if (options[index] !== value) onChange(options[index]!);
          }}
          onKeyDown={(event) => {
            const index = options.indexOf(value);
            const next = {
              ArrowDown: index + 1,
              ArrowUp: index - 1,
              PageDown: index + 5,
              PageUp: index - 5,
              Home: 0,
              End: options.length - 1,
            }[event.key];
            if (next !== undefined) {
              event.preventDefault();
              choose(next);
            }
          }}
        >
          {options.map((option, index) => (
            <div
              key={option}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option === value}
              onClick={() => choose(index)}
            >
              {option}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
