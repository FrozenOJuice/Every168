import { currentHourMinute } from "./calendar-times";
import { activityOnDate } from "./calendar-activity";
import { ActivityIcon } from "./calendar-day-feed";
import type { CalendarActivity } from "@168hours/contracts";
import { useCalendarInteractions } from "./calendar-interactions";
import { CalendarItemButton } from "./calendar-item-button";
import { itemsOnDate, type CalendarFilter } from "./calendar-filters";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Week, CalendarItem } from "@168hours/contracts";
import { instantToLocalInput, overlaps } from "@168hours/domain-utils";
import { formatDate, formatTime } from "@/lib/format";
import { CalendarRecord } from "./calendar-record";
import { CalendarHourSlot } from "./calendar-hour-slot";
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
  const days = week.days.filter((day) => view === "week" || day.date === date);
  const single = view === "day";
  const clockChange =
    single &&
    days.some(
      (day) => Date.parse(day.endsAt) - Date.parse(day.startsAt) !== 86400000,
    );
  const hasAnytime = days.some(
    (day) => itemsOnDate(items, day.date, filter).length > 0,
  );
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
          layoutDay(dayRecords(week, day.date, filter), day, hourHeight).map(
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
          {!single && (
            <div className="calendar-grid-head">
              <span className="grid-zone">Time</span>
              {days.map((day) => {
                const hidden =
                  single ||
                  Date.parse(day.endsAt) - Date.parse(day.startsAt) !== 86400000
                    ? 0
                    : visibleWeekSegments(
                        layoutDay(
                          dayRecords(week, day.date, filter),
                          day,
                          hourHeight,
                        ),
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
                      onClick={(event) => {
                        interaction?.selectTime({ date: day.date });
                        onSelectDay(
                          day.date,
                          event.shiftKey
                            ? "extend"
                            : event.metaKey || event.ctrlKey
                              ? "toggle"
                              : "replace",
                        );
                      }}
                      onDoubleClick={() =>
                        router.push(calendarHref(day.date, "day"), {
                          scroll: false,
                        })
                      }
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
          )}
          {hasAnytime && (
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
              const selection = interaction?.preview?.selection ?? draft;
              const selectionTop = selection
                ? Math.max(
                    0,
                    (Date.parse(selection.startsAt) -
                      Date.parse(day.startsAt)) /
                      60000,
                  )
                : 0;
              const selectionBottom = selection
                ? Math.min(
                    1440,
                    (Date.parse(selection.endsAt) - Date.parse(day.startsAt)) /
                      60000,
                  )
                : 0;
              const resize = interaction?.preview?.resize;
              const previewRecords = resize
                ? dayRecords(
                    {
                      ...week,
                      blocks: week.blocks.map((block) =>
                        block.id === resize.id
                          ? {
                              ...block,
                              startsAt: resize.startsAt,
                              endsAt: resize.endsAt,
                            }
                          : block,
                      ),
                    },
                    day.date,
                    filter,
                  )
                : records;
              const segments = changed
                ? []
                : layoutDay(previewRecords, day, hourHeight).map((segment) => {
                    if (segment.record.item.id !== resize?.id) return segment;
                    return {
                      ...segment,
                      top: Math.max(
                        0,
                        (Date.parse(resize.startsAt) -
                          Date.parse(day.startsAt)) /
                          60000,
                      ),
                      bottom: Math.min(
                        1440,
                        (Date.parse(resize.endsAt) - Date.parse(day.startsAt)) /
                          60000,
                      ),
                    };
                  });
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
                    (day.date === today ? "is-today" : "")
                  }
                >
                  {changed ? (
                    <div className="grid-day-fallback">
                      <p>Clock change</p>
                      {draft && overlaps(draft, day) && (
                        <div
                          className="calendar-draft-card"
                          data-calendar-draft={day.date}
                          role="img"
                          aria-label={`Draft plan: ${draft.title || "New plan"}`}
                        >
                          <strong>{draft.title || "New plan"}</strong>
                          <span>
                            {formatTime(draft.startsAt, week.timezone, true)} -{" "}
                            {formatTime(draft.endsAt, week.timezone, true)}
                          </span>
                        </div>
                      )}
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
                            onClick={() =>
                              onAdd(
                                day.date,
                                currentHourMinute(
                                  new Date().toISOString(),
                                  week.timezone,
                                ),
                              )
                            }
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
                          currentHour={Math.floor(nowMinute / 60)}
                          hourHeight={hourHeight}
                          tickMinutes={tickMinutes}
                          onAdd={onAdd}
                          onQuickAction={onQuickAction}
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
                            style={{ top: hour * hourHeight + 14 }}
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
                            top: (top / 60) * hourHeight,
                            height: ((bottom - top) / 60) * hourHeight,
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
                                  onClick={() =>
                                    interaction?.select(record.item.id)
                                  }
                                  onDoubleClick={() => onOpen(record, day.date)}
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
                                  onClick={() =>
                                    interaction?.select(record.item.id)
                                  }
                                  onDoubleClick={() => onOpen(record, day.date)}
                                />
                              )}
                            </>
                          )}
                          <CalendarRecord
                            record={record}
                            week={week}
                            compact
                            date={day.date}
                            short={((bottom - top) / 60) * hourHeight < 66}
                            onOpen={() => onOpen(record, day.date)}
                          />
                        </div>
                      ))}
                      {selection && selectionBottom > selectionTop && (
                        <div
                          className="calendar-draft-block"
                          data-calendar-draft={draft ? day.date : undefined}
                          role="img"
                          aria-label={`Draft plan: ${draft ? draft.title || "New plan" : interaction?.preview?.label}`}
                          style={{
                            top: (selectionTop / 60) * hourHeight,
                            height:
                              ((selectionBottom - selectionTop) / 60) *
                              hourHeight,
                          }}
                        >
                          <strong>{draft?.title || "New plan"}</strong>
                          <span>
                            {formatTime(selection.startsAt, week.timezone)} -{" "}
                            {formatTime(selection.endsAt, week.timezone)}
                          </span>
                          {interaction?.preview?.selection && (
                            <span>{day.date}</span>
                          )}
                          {interaction?.preview?.selection && (
                            <small className="calendar-drag-hint">
                              Escape to cancel
                            </small>
                          )}
                        </div>
                      )}
                      {day.date === today && (
                        <div
                          className="calendar-now"
                          style={{ top: (nowMinute / 60) * hourHeight }}
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
          Scroll for more hours and days. Double-click a day heading to open
          Day.
        </p>
      )}
    </section>
  );
}
