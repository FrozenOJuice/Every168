"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { addDays, localDate, weekRange } from "@168hours/domain-utils";
import type { CalendarActivity } from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { useCalendar } from "@/features/planning/use-calendar";
import { useCalendarClock } from "@/features/planning/use-calendar-clock";
import { CalendarDayFeed } from "@/features/planning/calendar-day-feed";
import { CalendarDatePicker } from "@/features/planning/calendar-date-picker";
import { emptyCalendarFilter } from "@/features/planning/calendar-filters";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";

export function DomainDayPanel({
  date,
  onDate,
  action,
  domain,
  sources,
  sourceLabels,
  plans,
  onActivity,
  onCalendar,
}: {
  date: string;
  onDate: (date: string) => void;
  domain: string;
  sources: readonly string[];
  sourceLabels: readonly string[];
  action?: { label: string; onClick: () => void };
  plans?: {
    blockIds: string[];
    pending: boolean;
    error: Error | null;
    retry: () => void;
  };
  onActivity: (activity: CalendarActivity) => void;
  onCalendar: () => void;
}) {
  const {
    preferences: { timezone, weekStartsOn },
  } = useMe();
  const now = useCalendarClock(new Date().toISOString());
  const today = localDate(now, timezone);
  const weekStart = weekRange(date, timezone, weekStartsOn).weekStart;
  const calendar = useCalendar(date, "day");
  const [all, setAll] = useState(false);
  const [picker, setPicker] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const anchor = useRef<HTMLButtonElement>(null);
  const closePicker = useCallback(() => setPicker(false), []);
  const activity =
    calendar.activity &&
    (all
      ? calendar.activity
      : {
          ...calendar.activity,
          entries: calendar.activity.entries.filter((entry) =>
            sources.includes(entry.source.type),
          ),
          truncatedSources: calendar.activity.truncatedSources.filter((s) =>
            sourceLabels.includes(s.label),
          ),
        });
  const week =
    calendar.week &&
    (all
      ? calendar.week
      : {
          ...calendar.week,
          blocks: calendar.week.blocks.filter((block) =>
            plans?.blockIds.includes(block.id),
          ),
          entries: [],
        });
  return (
    <div className="domain-day-panel">
      <header className="domain-day-heading">
        <div>
          <CalendarDays size={17} aria-hidden="true" />
          <h2>Your day</h2>
        </div>
        <Link
          href={`/?date=${date}&view=day`}
          className="icon-button"
          aria-label="Open full Calendar"
        >
          <ArrowUpRight size={19} />
        </Link>
      </header>
      <div className="domain-day-date">
        <button
          className="icon-button"
          aria-label="Previous day"
          onClick={() => onDate(addDays(date, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          ref={anchor}
          className="domain-date-title"
          aria-haspopup="dialog"
          aria-expanded={picker}
          onClick={(event) => {
            setPortalContainer(event.currentTarget.closest("dialog"));
            setPicker(!picker);
          }}
        >
          <span>
            {formatDate(date, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </button>
        <button
          className="icon-button"
          aria-label="Next day"
          onClick={() => onDate(addDays(date, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {picker && (
        <CalendarDatePicker
          date={date}
          today={today}
          weekStart={weekStart}
          view="day"
          anchor={anchor}
          onClose={closePicker}
          portalContainer={portalContainer}
          onSelect={(value) => {
            onDate(value);
            closePicker();
          }}
        />
      )}
      <div className="domain-week-strip" aria-label="Choose a day">
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(weekStart, i);
          return (
            <button
              key={day}
              aria-label={formatDate(day, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              aria-pressed={day === date}
              aria-current={day === today ? "date" : undefined}
              onClick={() => onDate(day)}
            >
              <span>{formatDate(day, { weekday: "short" }).slice(0, 1)}</span>
              <strong>{Number(day.slice(8))}</strong>
            </button>
          );
        })}
      </div>
      <div className="domain-day-controls">
        <span>
          {formatDate(date, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </span>
        <button className="text-button" onClick={() => onDate(today)}>
          Today
        </button>
      </div>
      <div
        className="domain-day-scope"
        role="group"
        aria-label="Day activity filter"
      >
        <button aria-pressed={!all} onClick={() => setAll(false)}>
          {domain}
        </button>
        <button aria-pressed={all} onClick={() => setAll(true)}>
          All activities
        </button>
      </div>
      <div className="domain-day-feed-wrap">
        {calendar.isPending ||
        calendar.activityPending ||
        (!all && plans?.pending) ? (
          <Loading />
        ) : !all && plans?.error ? (
          <ErrorState error={plans.error} retry={plans.retry} />
        ) : calendar.error ? (
          <ErrorState error={calendar.error} retry={calendar.retry} />
        ) : calendar.activityError ? (
          <ErrorState
            error={calendar.activityError}
            retry={calendar.retryActivity}
          />
        ) : week && activity ? (
          <CalendarDayFeed
            date={date}
            week={week}
            items={all ? calendar.items : []}
            activity={activity}
            filter={emptyCalendarFilter}
            now={now}
            onOpen={onCalendar}
            onOpenActivity={onActivity}
          />
        ) : null}
      </div>
      <footer className="domain-day-footer">
        {action && (
          <button className="button" onClick={action.onClick}>
            <Plus size={16} aria-hidden="true" />
            {action.label}
          </button>
        )}
        <Link href={`/?date=${date}&view=day`}>
          Open Calendar <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
