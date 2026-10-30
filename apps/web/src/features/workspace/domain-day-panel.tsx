"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
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
import { DomainDayActivities } from "./domain-day-activities";
import { CalendarDatePicker } from "@/features/planning/calendar-date-picker";
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
  onBusyChange,
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
  onBusyChange?: (busy: boolean) => void;
}) {
  const {
    preferences: { timezone, weekStartsOn },
  } = useMe();
  const now = useCalendarClock(new Date().toISOString());
  const today = localDate(now, timezone);
  const weekStart = weekRange(date, timezone, weekStartsOn).weekStart;
  const calendar = useCalendar(date, "day");
  const [busy, setBusy] = useState(false);
  const reportBusy = useCallback(
    (value: boolean) => {
      setBusy(value);
      onBusyChange?.(value);
    },
    [onBusyChange],
  );
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
      <h2 className="sr-only">Day overview</h2>
      <div className="domain-day-date">
        <button
          className="icon-button"
          disabled={busy}
          aria-label="Previous day"
          onClick={() => onDate(addDays(date, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          ref={anchor}
          className="calendar-date-title domain-date-title"
          disabled={busy}
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
          disabled={busy}
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
      <div className="domain-week-strip" role="group" aria-label="Choose a day">
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(weekStart, i);
          return (
            <button
              key={day}
              disabled={busy}
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
              <span>{formatDate(day, { weekday: "short" }).slice(0, 2)}</span>
              <strong>{Number(day.slice(8))}</strong>
            </button>
          );
        })}
      </div>
      <div className="domain-day-controls">
        <button
          className="button"
          disabled={busy}
          onClick={() => onDate(today)}
        >
          Today
        </button>
        <div
          className="domain-day-scope"
          role="group"
          aria-label="Day activity filter"
        >
          <button
            disabled={busy}
            aria-pressed={!all}
            onClick={() => setAll(false)}
          >
            {domain}
          </button>
          <button
            disabled={busy}
            aria-pressed={all}
            onClick={() => setAll(true)}
          >
            All activities
          </button>
        </div>
      </div>
      <div className="domain-day-feed-wrap">
        {(calendar.isPending ||
          calendar.activityPending ||
          (!all && plans?.pending)) && <Loading />}
        {!all && plans?.error && (
          <ErrorState error={plans.error} retry={plans.retry} />
        )}
        {calendar.error && (
          <ErrorState error={calendar.error} retry={calendar.retry} />
        )}
        {calendar.activityError && (
          <ErrorState
            error={calendar.activityError}
            retry={calendar.retryActivity}
          />
        )}
        {week &&
          activity &&
          !calendar.isPending &&
          !calendar.activityPending &&
          !(!all && plans?.pending) && (
            <DomainDayActivities
              date={date}
              week={week}
              items={all ? calendar.items : []}
              activity={activity}
              scope={`${date}:${all}`}
              onDate={onDate}
              onBusyChange={reportBusy}
              now={now}
              emptyMessage={
                all ? undefined : `No ${domain} plans or activity for this day.`
              }
              onActivity={onActivity}
            />
          )}
      </div>
      <footer className="domain-day-footer">
        {action && (
          <button className="button" disabled={busy} onClick={action.onClick}>
            <Plus size={16} aria-hidden="true" />
            {action.label}
          </button>
        )}
        <Link
          className="button domain-day-calendar"
          aria-disabled={busy || undefined}
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            if (!busy) onCalendar();
          }}
          href={`/?date=${date}&view=day`}
        >
          <CalendarDays size={17} aria-hidden="true" />
          <span>Open Calendar</span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
