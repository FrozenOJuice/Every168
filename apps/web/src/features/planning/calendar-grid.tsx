import { activityOnDate } from "./calendar-activity";
import { ActivityIcon } from "./calendar-day-feed";
import type { CalendarActivity } from "@168hours/contracts";
import { useCalendarInteractions } from "./calendar-interactions";
import { CalendarItemButton } from "./calendar-item-button";
import { itemsOnDate, type CalendarFilter } from "./calendar-filters";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import type { Week, CalendarItem } from "@168hours/contracts";
import { instantToLocalInput } from "@168hours/domain-utils";
import { formatDate, formatTime } from "@/lib/format";
import { CalendarRecord } from "./calendar-record";
import { CalendarHourSlot } from "./calendar-hour-slot";
import {
  calendarHref,
  dayRecords,
  layoutDay,
  visibleWeekSegments,
  HOUR_HEIGHT,
  type CalendarRecord as Record,
} from "./calendar-layout";

export type CalendarScrollPosition = {
  top?: number;
  weekLeft?: number;
  focusDate?: string;
};

export function CalendarGrid({
  week,
  activity,
  date,
  today,
  view,
  onOpen,
  onAdd,
  onShowDay,
  now,
  getScrollPosition,
  saveScrollPosition,
  scrollReset,
  items,
  filter,
  onOpenItem,
}: {
  week: Week;
  activity: CalendarActivity[];
  date: string;
  today: string;
  view: "week" | "day";
  onOpen: (record: Record, date: string) => void;
  onAdd: (date: string, minute: number) => void;
  onShowDay: (date: string) => void;
  now: string;
  getScrollPosition: () => CalendarScrollPosition;
  saveScrollPosition: (position: CalendarScrollPosition) => void;
  scrollReset: number;
  items: CalendarItem[];
  filter: CalendarFilter;
  onOpenItem: (item: CalendarItem) => void;
}) {
  const interaction = useCalendarInteractions();
  const scroll = useRef<HTMLDivElement>(null);
  const days = week.days.filter((day) => view === "week" || day.date === date);
  const single = view === "day";
  const clockChange =
    single &&
    days.some(
      (day) => Date.parse(day.endsAt) - Date.parse(day.startsAt) !== 86400000,
    );
  const maxLanes = single
    ? Math.max(
        1,
        ...days.flatMap((day) =>
          layoutDay(dayRecords(week, day.date, filter), day).map(
            (segment) => segment.lanes,
          ),
        ),
      )
    : 1;
  const localNow = instantToLocalInput(now, week.timezone);
  const nowMinute =
    Number(localNow.slice(11, 13)) * 60 + Number(localNow.slice(14, 16));
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const remembered = getScrollPosition();
    if (remembered.focusDate && remembered.focusDate !== date) return;
    const initialTop =
      date === today
        ? Math.max(0, (nowMinute / 60 - 1) * HOUR_HEIGHT)
        : HOUR_HEIGHT * 7;
    element.scrollTop = clockChange ? 0 : (remembered.top ?? initialTop);
    const day = element.querySelector<HTMLElement>(
      '[data-date="' + date + '"]',
    );
    element.scrollLeft = single
      ? 0
      : (remembered.weekLeft ?? Math.max(0, (day?.offsetLeft ?? 0) - 52));
    saveScrollPosition({
      top: clockChange ? remembered.top : element.scrollTop,
      weekLeft: single ? remembered.weekLeft : element.scrollLeft,
    });
  }, [
    week.days,
    date,
    single,
    clockChange,
    nowMinute,
    today,
    getScrollPosition,
    saveScrollPosition,
    scrollReset,
  ]);
  return (
    <section
      className={"calendar-grid " + (single ? "daily-grid" : "weekly-grid")}
      aria-label={single ? "Daily time grid" : "Weekly time grid"}
    >
      <div
        className="calendar-scroll"
        ref={scroll}
        onScroll={(event) => {
          const remembered = getScrollPosition();
          if (remembered.focusDate) return;
          saveScrollPosition({
            top: clockChange ? remembered.top : event.currentTarget.scrollTop,
            weekLeft: single
              ? remembered.weekLeft
              : event.currentTarget.scrollLeft,
          });
        }}
        tabIndex={0}
        aria-label="Scroll calendar days and hours"
      >
        <div
          className="calendar-grid-canvas"
          style={
            {
              "--day-count": days.length,
              "--calendar-min-width": single
                ? Math.max(280, maxLanes * 112 + 52) + "px"
                : "1032px",
            } as CSSProperties
          }
        >
          <div className="calendar-grid-head">
            <span className="grid-zone">Time</span>
            {days.map((day) => {
              const hidden =
                single ||
                Date.parse(day.endsAt) - Date.parse(day.startsAt) !== 86400000
                  ? 0
                  : visibleWeekSegments(
                      layoutDay(dayRecords(week, day.date, filter), day),
                    ).hidden;
              return (
                <div
                  key={day.date}
                  data-date={day.date}
                  className={
                    "grid-day-heading" + (day.date === today ? " is-today" : "")
                  }
                >
                  <Link
                    href={calendarHref(day.date, "day")}
                    scroll={false}
                    aria-label={"Day view for " + day.date}
                  >
                    <span>
                      {formatDate(day.date, {
                        weekday: single ? "long" : "short",
                      })}
                    </span>
                    <strong>{formatDate(day.date, { day: "numeric" })}</strong>
                  </Link>
                  {activityOnDate(
                    activity,
                    day.date,
                    week.timezone,
                    filter,
                  ).filter((entry) => entry.kind === "moment").length > 0 && (
                    <button
                      className="text-button calendar-moment-count"
                      onClick={() => onShowDay(day.date)}
                      aria-label={"Show moments for " + day.date}
                    >
                      {
                        activityOnDate(
                          activity,
                          day.date,
                          week.timezone,
                          filter,
                        ).filter((entry) => entry.kind === "moment").length
                      }{" "}
                      moments
                    </button>
                  )}
                  {hidden > 0 && (
                    <button
                      className="grid-more"
                      aria-label={`Show all records for ${day.date}, ${hidden} more`}
                      onClick={() => onShowDay(day.date)}
                    >
                      +{hidden}
                      <span className="sr-only"> more</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {days.some(
            (day) => itemsOnDate(items, day.date, filter).length > 0,
          ) && (
            <div className="calendar-anytime-row">
              <span className="grid-zone">Any time</span>
              {days.map((day) => {
                const plans = itemsOnDate(items, day.date, filter);
                return (
                  <div key={day.date} className="calendar-anytime-cell">
                    {plans.slice(0, 1).map((item) => (
                      <CalendarItemButton
                        key={item.id}
                        item={item}
                        compact
                        onOpen={() => onOpenItem(item)}
                      />
                    ))}
                    {plans.length > 1 && (
                      <button
                        className="text-button"
                        onClick={() => onShowDay(day.date)}
                        aria-label={`Show all records for ${day.date}, ${plans.length - 1} more date-only plans`}
                      >
                        +{plans.length - 1} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div
            className={
              "calendar-grid-body" + (clockChange ? " clock-change-day" : "")
            }
            style={clockChange ? undefined : { height: 24 * HOUR_HEIGHT }}
          >
            <div className="hour-axis" aria-hidden="true">
              {!clockChange &&
                Array.from({ length: 24 }, (_, hour) => (
                  <span key={hour} style={{ top: hour * HOUR_HEIGHT }}>
                    {String(hour).padStart(2, "0")}:00
                  </span>
                ))}
            </div>
            {days.map((day) => {
              const records = dayRecords(week, day.date, filter);
              const moments = activityOnDate(
                activity,
                day.date,
                week.timezone,
                filter,
              ).filter((entry) => entry.kind === "moment");
              const momentHours = [
                ...new Set(
                  moments.map((entry) =>
                    Number(
                      instantToLocalInput(
                        entry.occurredAt,
                        week.timezone,
                      ).slice(11, 13),
                    ),
                  ),
                ),
              ];
              const changed =
                Date.parse(day.endsAt) - Date.parse(day.startsAt) !== 86400000;
              const segments = changed ? [] : layoutDay(records, day);
              const visible = single
                ? segments
                : visibleWeekSegments(segments).visible;
              return (
                <div
                  key={day.date}
                  data-drag-day={changed ? undefined : day.date}
                  className={
                    "grid-day " +
                    (moments.length ? "has-moments " : "") +
                    (day.date === today ? "is-today" : "") +
                    (interaction?.preview?.point.date === day.date
                      ? " is-drag-target"
                      : "")
                  }
                >
                  {changed ? (
                    <div className="grid-day-fallback">
                      <p>Clock change</p>
                      {day.date === today && (
                        <p className="calendar-now-text">
                          Now · {formatTime(now, week.timezone, true)}
                        </p>
                      )}
                      {single ? (
                        <>
                          <p className="muted text-small">
                            Times include their timezone to distinguish repeated
                            or missing hours.
                          </p>
                          <ol className="day-records">
                            {records.map((record) => (
                              <li key={record.kind + record.item.id}>
                                <CalendarRecord
                                  record={record}
                                  week={week}
                                  onOpen={() => onOpen(record, day.date)}
                                />
                              </li>
                            ))}
                          </ol>
                          {!records.length && (
                            <p className="muted">
                              No time planned or recorded for this day.
                            </p>
                          )}
                          <button
                            className="button"
                            onClick={() => onAdd(day.date, 540)}
                          >
                            Add block
                          </button>
                        </>
                      ) : (
                        <>
                          <small>
                            {records.length} records. Open this day for a clear
                            view of every time.
                          </small>
                          <Link
                            className="button"
                            href={calendarHref(day.date, "day")}
                            scroll={false}
                          >
                            View day
                          </Link>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {Array.from({ length: 24 }, (_, hour) => (
                        <CalendarHourSlot
                          key={hour}
                          date={day.date}
                          hour={hour}
                          onAdd={onAdd}
                        />
                      ))}
                      {momentHours.map((hour) => {
                        const entries = moments.filter(
                          (entry) =>
                            Number(
                              instantToLocalInput(
                                entry.occurredAt,
                                week.timezone,
                              ).slice(11, 13),
                            ) === hour,
                        );
                        return (
                          <button
                            key={hour}
                            className="calendar-moment-marker"
                            style={{ top: hour * HOUR_HEIGHT + 14 }}
                            onClick={() => onShowDay(day.date)}
                            aria-label={`${entries.length} moment${entries.length === 1 ? "" : "s"} at ${String(hour).padStart(2, "0")}:00 on ${day.date}: ${entries.map((entry) => entry.title + " " + entry.summary).join(", ")}`}
                          >
                            <ActivityIcon name={entries[0]!.icon} />
                            {entries.length > 1 && (
                              <small>{entries.length}</small>
                            )}
                          </button>
                        );
                      })}
                      {visible.map(({ record, top, bottom, lane, lanes }) => (
                        <div
                          className="grid-record"
                          key={record.kind + record.item.id}
                          style={{
                            top: (top / 60) * HOUR_HEIGHT,
                            height: ((bottom - top) / 60) * HOUR_HEIGHT,
                            left: moments.length
                              ? `calc((100% - 44px) * ${lane / lanes})`
                              : (lane / lanes) * 100 + "%",
                            width: moments.length
                              ? `calc((100% - 44px) / ${lanes})`
                              : 100 / lanes + "%",
                          }}
                        >
                          {record.kind === "block" && (
                            <>
                              {Date.parse(record.item.startsAt) >=
                                Date.parse(day.startsAt) && (
                                <button
                                  tabIndex={-1}
                                  aria-hidden="true"
                                  className="calendar-resize-handle resize-start"
                                  aria-label={
                                    "Resize start of " + record.item.title
                                  }
                                  onPointerDown={(event) =>
                                    interaction?.start(
                                      event,
                                      "start",
                                      record.item,
                                      day.date,
                                    )
                                  }
                                  onClick={() => onOpen(record, day.date)}
                                />
                              )}
                              {Date.parse(record.item.endsAt) <=
                                Date.parse(day.endsAt) && (
                                <button
                                  tabIndex={-1}
                                  aria-hidden="true"
                                  className="calendar-resize-handle resize-end"
                                  aria-label={
                                    "Resize end of " + record.item.title
                                  }
                                  onPointerDown={(event) =>
                                    interaction?.start(
                                      event,
                                      "end",
                                      record.item,
                                      day.date,
                                    )
                                  }
                                  onClick={() => onOpen(record, day.date)}
                                />
                              )}
                            </>
                          )}
                          <CalendarRecord
                            record={record}
                            week={week}
                            compact
                            date={day.date}
                            short={((bottom - top) / 60) * HOUR_HEIGHT < 66}
                            onOpen={() => onOpen(record, day.date)}
                          />
                        </div>
                      ))}
                      {day.date === today && (
                        <div
                          className="calendar-now"
                          style={{ top: (nowMinute / 60) * HOUR_HEIGHT }}
                          role="img"
                          aria-label={
                            "Current time: " +
                            formatTime(now, week.timezone, true)
                          }
                        >
                          <span aria-hidden="true">
                            {formatTime(now, week.timezone)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {!single && (
        <p className="calendar-scroll-hint">
          Scroll for more hours and days. Select a date to open Day.
        </p>
      )}
    </section>
  );
}
