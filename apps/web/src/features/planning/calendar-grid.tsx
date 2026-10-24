import { activityOnDate } from "./calendar-activity";
import type { CalendarActivity } from "@168hours/contracts";
import { useCalendarInteractions } from "./calendar-interactions";
import { CalendarItemButton } from "./calendar-item-button";
import { itemsOnDate, type CalendarFilter } from "./calendar-filters";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Week, CalendarItem } from "@168hours/contracts";
import { instantToLocalInput } from "@168hours/domain-utils";
import { formatDate } from "@/lib/format";
import { CalendarTimedDay } from "./calendar-timed-day";
import { useCalendarHeaderSelection } from "./use-calendar-header-selection";
import { CalendarTimeAxis } from "./calendar-time-axis";
import type { TimeScaleAnchor } from "./calendar-time-axis";
import {
  calendarHref,
  dayRecords,
  layoutDay,
  visibleWeekSegments,
  timeScaleScrollTop,
  type CalendarRecord as Record,
  type CalendarDraft,
  type TimeTickMinutes,
} from "./calendar-layout";

export type CalendarScrollPosition = {
  top?: number;
  weekLeft?: number;
  focusDate?: string;
};

export function CalendarGrid({
  draft,
  week,
  activity,
  date,
  today,
  view,
  onOpen,
  onAdd,
  onQuickAction,
  onShowDay,
  selectedDays,
  onSelectDay,
  onSelectRange,
  now,
  hourHeight,
  minimumHourHeight,
  tickMinutes,
  onHourHeightChange,
  onMinimumHourHeightChange,
  getScrollPosition,
  saveScrollPosition,
  scrollReset,
  items,
  filter,
  onOpenItem,
}: {
  draft?: CalendarDraft | null;
  week: Week;
  activity: CalendarActivity[];
  date: string;
  today: string;
  view: "week" | "day";
  onOpen: (record: Record, date: string) => void;
  onAdd: (date: string, minute: number) => void;
  onQuickAction: (date: string, minute: number) => void;
  onShowDay: (date: string) => void;
  selectedDays: string[];
  onSelectDay: (date: string, mode?: "replace" | "toggle" | "extend") => void;
  onSelectRange: (first: string, last: string) => void;
  now: string;
  hourHeight: number;
  minimumHourHeight: number;
  tickMinutes: TimeTickMinutes;
  onHourHeightChange: (height: number, anchor?: TimeScaleAnchor) => void;
  onMinimumHourHeightChange: (height: number) => void;
  getScrollPosition: () => CalendarScrollPosition;
  saveScrollPosition: (position: CalendarScrollPosition) => void;
  scrollReset: number;
  items: CalendarItem[];
  filter: CalendarFilter;
  onOpenItem: (item: CalendarItem) => void;
}) {
  const interaction = useCalendarInteractions();
  const router = useRouter();
  const scroll = useRef<HTMLDivElement>(null);
  const scaleAnchor = useRef<TimeScaleAnchor | null>(null);
  const { consumeHeaderClick, isHeaderClickSuppressed, startHeaderRange } =
    useCalendarHeaderSelection(scroll, onSelectDay, onSelectRange);
  const days = week.days.filter((day) => view === "week" || day.date === date);
  const single = view === "day";
  const clockChange =
    single &&
    days.some(
      (day) => Date.parse(day.endsAt) - Date.parse(day.startsAt) !== 86400000,
    );
  const allDayPlansOnDate = (date: string) =>
    itemsOnDate(
      items.map((item) =>
        interaction?.preview?.dateResize?.id === item.id
          ? interaction.preview.dateResize
          : item,
      ),
      date,
      filter,
    ).filter((item) => item.kind === "all_day");
  const hasAllDay = days.some(
    (day) =>
      allDayPlansOnDate(day.date).length > 0 ||
      itemsOnDate(items, day.date, filter).some(
        (item) => item.kind === "all_day",
      ),
  );
  const unscheduledPlansOnDate = (date: string) =>
    itemsOnDate(items, date, filter).filter(
      (item) => item.kind === "unscheduled",
    );
  const hasUnscheduled = days.some(
    (day) => unscheduledPlansOnDate(day.date).length > 0,
  );
  const hasAnytime = hasAllDay || hasUnscheduled;
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || clockChange) return;
    const measure = () => {
      const head = element.querySelector<HTMLElement>(".calendar-grid-head");
      const anytime = element.querySelector<HTMLElement>(
        ".calendar-anytime-row",
      );
      const available =
        element.clientHeight -
        (head?.offsetHeight ?? 0) -
        (anytime?.offsetHeight ?? 0);
      if (available > 0) onMinimumHourHeightChange(available / 24);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const head = element.querySelector<HTMLElement>(".calendar-grid-head");
    const anytime = element.querySelector<HTMLElement>(".calendar-anytime-row");
    if (head) observer.observe(head);
    if (anytime) observer.observe(anytime);
    return () => observer.disconnect();
  }, [clockChange, hasAnytime, single, onMinimumHourHeightChange]);
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
        ? Math.max(0, (nowMinute / 60 - 1) * hourHeight)
        : hourHeight * 7;
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
    hourHeight,
    today,
    getScrollPosition,
    saveScrollPosition,
    scrollReset,
  ]);
  useLayoutEffect(() => {
    const anchor = scaleAnchor.current;
    const element = scroll.current;
    if (!anchor || !element) return;
    element.scrollTop = timeScaleScrollTop(
      anchor,
      hourHeight,
      minimumHourHeight,
    );
    saveScrollPosition({
      ...getScrollPosition(),
      top: element.scrollTop,
    });
  }, [hourHeight, minimumHourHeight, getScrollPosition, saveScrollPosition]);
  useLayoutEffect(() => {
    if (!draft?.startsAt) return;
    const element = scroll.current;
    const preview = element?.querySelector<HTMLElement>(
      "[data-calendar-draft]",
    );
    if (!element || !preview) return;
    const dayLayout = element.closest<HTMLElement>(".calendar-day-layout");
    if (dayLayout) dayLayout.scrollTop = 0;
    const bounds = element.getBoundingClientRect();
    const block = preview.getBoundingClientRect();
    const top =
      bounds.top +
      (element.querySelector(".calendar-grid-head")?.getBoundingClientRect()
        .height ?? 0) +
      8;
    const bottom = bounds.bottom - 8;
    // Scroll only the calendar, keeping wide Day layouts at their normal left edge.
    if (block.top < top || block.height > bottom - top)
      element.scrollTop += block.top - top;
    else if (block.bottom > bottom) element.scrollTop += block.bottom - bottom;
    if (single) element.scrollLeft = 0;
    else {
      const column = preview.closest(".grid-day")?.getBoundingClientRect();
      if (
        column &&
        (column.left < bounds.left + 52 || column.right > bounds.right)
      )
        element.scrollLeft += column.left - bounds.left - 52;
    }
  }, [draft?.startsAt, single]);
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
          {single && (
            <div className="calendar-grid-head">
              <span className="grid-zone">Time</span>
              <div
                data-date={date}
                className={
                  "grid-day-heading" +
                  (date === today ? " is-today" : "") +
                  (selectedDays.includes(date) ? " is-selected" : "")
                }
              >
                <button
                  className="grid-day-label"
                  type="button"
                  aria-label={"Select " + date}
                  aria-pressed={selectedDays.includes(date)}
                  onPointerDown={(event) => startHeaderRange(event, date)}
                  onClick={(event) => {
                    if (consumeHeaderClick()) return;

                    onSelectDay(
                      date,
                      interaction?.daySelectionMode(event) ?? "replace",
                    );
                  }}
                >
                  <span>{formatDate(date, { weekday: "long" })}</span>
                  <strong>{formatDate(date, { day: "numeric" })}</strong>
                </button>
              </div>
            </div>
          )}
          {!single && (
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
                      "grid-day-heading" +
                      (day.date === today ? " is-today" : "") +
                      (selectedDays.includes(day.date) ? " is-selected" : "")
                    }
                  >
                    <button
                      type="button"
                      aria-label={"Select " + day.date}
                      aria-pressed={selectedDays.includes(day.date)}
                      onPointerDown={(event) =>
                        startHeaderRange(event, day.date)
                      }
                      onClick={(event) => {
                        if (consumeHeaderClick()) return;

                        onSelectDay(
                          day.date,
                          interaction?.daySelectionMode(event) ?? "replace",
                        );
                      }}
                      onDoubleClick={() => {
                        if (
                          !isHeaderClickSuppressed() &&
                          !interaction?.multiSelect
                        )
                          router.push(calendarHref(day.date, "day"), {
                            scroll: false,
                          });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || interaction?.busy) return;
                        event.preventDefault();
                        router.push(calendarHref(day.date, "day"), {
                          scroll: false,
                        });
                      }}
                    >
                      <span>
                        {formatDate(day.date, {
                          weekday: "short",
                        })}
                      </span>
                      <strong>
                        {formatDate(day.date, { day: "numeric" })}
                      </strong>
                    </button>
                    {activityOnDate(
                      activity,
                      day.date,
                      week.timezone,
                      filter,
                    ).filter(
                      (entry) =>
                        entry.kind === "moment" || entry.kind === "task",
                    ).length > 0 && (
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
                          ).filter(
                            (entry) =>
                              entry.kind === "moment" || entry.kind === "task",
                          ).length
                        }{" "}
                        {activityOnDate(
                          activity,
                          day.date,
                          week.timezone,
                          filter,
                        ).some((e) => e.kind === "task")
                          ? "tasks / moments"
                          : "moments"}
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
          )}
          {hasAnytime && (
            <div className="calendar-anytime-row">
              {hasAllDay && (
                <div className="calendar-date-row calendar-all-day-row">
                  <span className="grid-zone">All day</span>
                  {days.map((day) => {
                    const plans = allDayPlansOnDate(day.date);
                    return (
                      <div
                        key={day.date}
                        className="calendar-anytime-cell"
                        data-context-all-day={day.date}
                        tabIndex={0}
                        role="group"
                        aria-label={`All-day area for ${day.date}`}
                      >
                        {plans.slice(0, 1).map((item) => (
                          <CalendarItemButton
                            key={item.id}
                            item={item}
                            date={day.date}
                            compact
                            titleOnly
                            onOpen={() => onOpenItem(item)}
                          />
                        ))}
                        {plans.length > 1 && (
                          <button
                            className="text-button"
                            onClick={() => onShowDay(day.date)}
                            aria-label={`Show all records for ${day.date}, ${plans.length - 1} more all-day plans`}
                          >
                            +{plans.length - 1} more
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {hasUnscheduled && (
                <div className="calendar-date-row calendar-unscheduled-row">
                  <span className="grid-zone">Any time</span>
                  {days.map((day) => {
                    const plans = unscheduledPlansOnDate(day.date);
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
            </div>
          )}
          <div
            className={
              "calendar-grid-body" + (clockChange ? " clock-change-day" : "")
            }
            style={clockChange ? undefined : { height: 24 * hourHeight }}
          >
            <CalendarTimeAxis
              hourHeight={hourHeight}
              minimumHourHeight={minimumHourHeight}
              tickMinutes={tickMinutes}
              onChange={(height, anchor) => {
                scaleAnchor.current = anchor ?? null;
                onHourHeightChange(height, anchor);
              }}
              onFinish={() => {
                requestAnimationFrame(() => {
                  scaleAnchor.current = null;
                });
              }}
              clockChange={clockChange}
            />
            {days.map((day) => (
              <CalendarTimedDay
                key={day.date}
                day={day}
                week={week}
                activity={activity}
                filter={filter}
                draft={draft}
                single={single}
                today={today}
                now={now}
                nowMinute={nowMinute}
                hourHeight={hourHeight}
                tickMinutes={tickMinutes}
                onOpen={onOpen}
                onAdd={onAdd}
                onQuickAction={onQuickAction}
                onShowDay={onShowDay}
              />
            ))}
          </div>
        </div>
      </div>
      {!single && (
        <p className="calendar-scroll-hint">
          Scroll for more hours and days. Double-click a day heading to open
          Day.
        </p>
      )}
    </section>
  );
}
