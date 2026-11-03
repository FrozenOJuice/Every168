"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, localDate, weekRange } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { CalendarDatePicker } from "@/features/planning/calendar-date-picker";
import { formatDate } from "@/lib/format";

export function FoodLogDate({
  date,
  disabled,
  onDate,
}: {
  date: string;
  disabled: boolean;
  onDate: (value: string) => void;
}) {
  const { preferences } = useMe();
  const today = localDate(new Date(), preferences.timezone);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <div className="food-log-date" role="group" aria-label="Food log date">
      <button
        className="icon-button"
        disabled={disabled}
        aria-label="Previous log day"
        onClick={() => onDate(addDays(date, -1))}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        ref={anchor}
        className="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {formatDate(date, { month: "short", day: "numeric", year: "numeric" })}
      </button>
      <button
        className="icon-button"
        disabled={disabled}
        aria-label="Next log day"
        onClick={() => onDate(addDays(date, 1))}
      >
        <ChevronRight size={18} />
      </button>
      {date !== today && (
        <button
          className="text-button"
          disabled={disabled}
          onClick={() => onDate(today)}
        >
          Today
        </button>
      )}
      {open && (
        <CalendarDatePicker
          date={date}
          today={today}
          weekStart={
            weekRange(date, preferences.timezone, preferences.weekStartsOn)
              .weekStart
          }
          view="day"
          anchor={anchor}
          onClose={() => setOpen(false)}
          onSelect={(value) => {
            onDate(value);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
