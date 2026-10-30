"use client";

import { useCallback, useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { dateSchema } from "@168hours/contracts";
import { localDate, weekRange } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { CalendarDatePicker } from "@/features/planning/calendar-date-picker";
import { formatDate } from "@/lib/format";

export function ProgramStartDate({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled: boolean;
}) {
  const { preferences } = useMe();
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const today = localDate(new Date(), preferences.timezone);
  const date = dateSchema.safeParse(value).success ? value : today;
  return (
    <div className="field fitness-program-start-date">
      <span id={`${id}-label`}>Start date</span>
      <button
        ref={anchor}
        type="button"
        className="button fitness-program-date"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        data-invalid={!!error}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open && !disabled}
        onClick={(event) => {
          setContainer(event.currentTarget.closest("main"));
          setOpen(!open);
        }}
      >
        <CalendarDays size={18} aria-hidden="true" />
        {dateSchema.safeParse(value).success
          ? formatDate(value, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Choose a date"}
      </button>
      <p className="muted text-small" id={`${id}-help`}>
        Suggest training dates from this day.
      </p>
      {error && (
        <p className="error" role="alert" id={`${id}-error`}>
          {error}
        </p>
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
            onChange(next);
            close();
          }}
        />
      )}
    </div>
  );
}
