"use client";

import { useCallback, useRef, useState } from "react";
import { SessionTimePicker } from "./session-time-picker";
import { CalendarDays, Clock, ChevronDown } from "lucide-react";
import { localDate, weekRange } from "@168hours/domain-utils";
import { CalendarDatePicker } from "@/features/planning/calendar-date-picker";
import { useMe } from "@/features/identity/me";
import { formatDate } from "@/lib/format";

export function SessionStartField({
  id = "session-start",
  kind = "start",
  value,
  onChange,
  invalid,
  describedBy,
  disabled,
}: {
  id?: string;
  kind?: "start" | "finish";
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
  disabled: boolean;
}) {
  const { preferences } = useMe();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [timeAnchor, setTimeAnchor] = useState<HTMLButtonElement | null>(null);
  const closeTime = useCallback(() => setTimeAnchor(null), []);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const today = localDate(new Date(), preferences.timezone);
  const date = /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : today;
  const time = value.split("T")[1] ?? "";
  return (
    <div className="fitness-session-start-field">
      <button
        ref={anchor}
        type="button"
        className="button"
        disabled={disabled}
        aria-label={`Choose ${kind} date`}
        aria-haspopup="dialog"
        aria-expanded={open && !disabled}
        onClick={(event) => {
          setContainer(event.currentTarget.closest("main"));
          closeTime();
          setOpen(!open);
        }}
      >
        <CalendarDays size={18} aria-hidden="true" />
        {formatDate(date, { month: "short", day: "numeric", year: "numeric" })}
      </button>
      <button
        id={id}
        type="button"
        className="button fitness-session-time-trigger"
        disabled={disabled}
        data-invalid={invalid}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-expanded={!!timeAnchor && !disabled}
        onClick={(event) => {
          close();
          setTimeAnchor(timeAnchor ? null : event.currentTarget);
        }}
      >
        <Clock size={18} aria-hidden="true" />
        <span>
          {/^\d{2}:\d{2}$/.test(time)
            ? `${Number(time.slice(0, 2)) % 12 || 12}:${time.slice(3)} ${Number(time.slice(0, 2)) >= 12 ? "PM" : "AM"}`
            : "Choose time"}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {timeAnchor && !disabled && (
        <SessionTimePicker
          label={`Choose ${kind} time`}
          value={time}
          anchor={timeAnchor}
          onClose={closeTime}
          onSelect={(next) => onChange(`${date}T${next}`)}
        />
      )}
      {open && !disabled && (
        <CalendarDatePicker
          date={date}
          today={today}
          weekStart={
            weekRange(date, preferences.timezone, preferences.weekStartsOn)
              .weekStart
          }
          view="day"
          anchor={anchor}
          portalContainer={container}
          onClose={close}
          onSelect={(next) => {
            onChange(`${next}T${time}`);
            close();
          }}
        />
      )}
    </div>
  );
}
