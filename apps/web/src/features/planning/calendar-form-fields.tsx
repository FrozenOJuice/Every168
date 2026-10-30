"use client";

import { useCallback, useContext, useId, useRef, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import { CalendarDays, Clock } from "lucide-react";
import { dateSchema } from "@168hours/contracts";
import { localDate, weekRange } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { SessionTimePicker } from "@/features/fitness/session-time-picker";
import { formatDate } from "@/lib/format";
import { FormDisabledContext } from "@/components/ui/form";
import { CalendarDatePicker } from "./calendar-date-picker";

/** Calendar form controls share the navigation calendar and scrolling time wheels. */
export function CalendarDateField({
  name,
  label,
  timezone,
  timed = false,
  fallbackDate,
  onChange,
}: {
  name: string;
  label: string;
  timezone: string;
  timed?: boolean;
  fallbackDate?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const { preferences } = useMe();
  const { control, formState } = useFormContext();
  const disabled = useContext(FormDisabledContext) || formState.isSubmitting;
  const {
    field,
    fieldState: { error },
  } = useController({ name, control });
  const anchor = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [timeAnchor, setTimeAnchor] = useState<HTMLButtonElement | null>(null);
  const closeDate = useCallback(() => setDateOpen(false), []);
  const closeTime = useCallback(() => setTimeAnchor(null), []);
  const today = localDate(new Date(), timezone);
  const value = typeof field.value === "string" ? field.value : "";
  const date = value.slice(0, 10);
  const time = timed ? value.slice(11, 16) : "";
  const pickerDate = dateSchema.safeParse(date).success
    ? date
    : fallbackDate || today;
  const errorId = error ? `${id}-error` : undefined;
  function change(next: string) {
    field.onChange(next);
    onChange?.(next);
  }
  return (
    <div className="field calendar-event-date-field">
      <label htmlFor={id}>{label}</label>
      <div className={timed ? "calendar-event-date-time" : undefined}>
        <button
          id={id}
          ref={(node) => {
            anchor.current = node;
            field.ref(node);
          }}
          type="button"
          className="button calendar-field-trigger"
          aria-label={timed ? `${label} date` : label}
          aria-haspopup="dialog"
          aria-expanded={dateOpen && !disabled}
          data-invalid={!!error}
          aria-describedby={errorId}
          disabled={disabled}
          onBlur={field.onBlur}
          onClick={(event) => {
            setContainer(
              event.currentTarget.closest(".calendar-plan-popover") ??
                event.currentTarget.closest("dialog[open]"),
            );
            closeTime();
            setDateOpen(!dateOpen);
          }}
        >
          <CalendarDays size={18} aria-hidden="true" />
          {dateSchema.safeParse(date).success
            ? formatDate(date, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Choose date"}
        </button>
        {timed && (
          <button
            type="button"
            className="button calendar-field-trigger"
            aria-label={`${label} time`}
            aria-haspopup="dialog"
            aria-expanded={!!timeAnchor && !disabled}
            data-invalid={!!error}
            aria-describedby={errorId}
            disabled={disabled}
            onBlur={field.onBlur}
            onClick={(event) => {
              closeDate();
              setTimeAnchor(timeAnchor ? null : event.currentTarget);
            }}
          >
            <Clock size={18} aria-hidden="true" />
            {/^\d{2}:\d{2}$/.test(time)
              ? `${Number(time.slice(0, 2)) % 12 || 12}:${time.slice(3)} ${Number(time.slice(0, 2)) >= 12 ? "PM" : "AM"}`
              : "Choose time"}
          </button>
        )}
      </div>
      {error && (
        <small id={errorId} className="error" role="alert">
          {error.message}
        </small>
      )}
      {dateOpen && !disabled && (
        <CalendarDatePicker
          date={pickerDate}
          today={today}
          weekStart={
            weekRange(pickerDate, timezone, preferences.weekStartsOn).weekStart
          }
          view="day"
          anchor={anchor}
          portalContainer={container}
          onClose={closeDate}
          onSelect={(next) => {
            change(timed ? `${next}T${time}` : next);
            closeDate();
          }}
        />
      )}
      {timeAnchor && !disabled && (
        <SessionTimePicker
          label={`Choose ${label.toLowerCase()} time`}
          value={time}
          anchor={timeAnchor}
          onClose={closeTime}
          onSelect={(next) => change(`${pickerDate}T${next}`)}
        />
      )}
    </div>
  );
}

export function CalendarChoiceField({
  name,
  label,
  options,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const { control } = useFormContext();
  const { field } = useController({ name, control });
  return (
    <div
      className="calendar-event-choices"
      role="radiogroup"
      aria-labelledby={id}
    >
      <span id={id}>{label}</span>
      <div>
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={field.name}
              value={option.value}
              checked={field.value === option.value}
              ref={option.value === options[0]?.value ? field.ref : undefined}
              onBlur={field.onBlur}
              onChange={() => {
                field.onChange(option.value);
                onChange?.(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
