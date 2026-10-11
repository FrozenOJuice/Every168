import { currentHourMinute } from "./calendar-times";
import { activityOnDate } from "./calendar-activity";
import { ActivityIcon } from "./calendar-day-feed";
import type { CalendarActivity } from "@168hours/contracts";
import { useCalendarInteractions } from "./calendar-interactions";
import { CalendarItemButton } from "./calendar-item-button";
import { itemsOnDate, type CalendarFilter } from "./calendar-filters";
import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  const suppressHeaderClick = useRef(false);
  const stopHeaderDrag = useRef<(() => void) | null>(null);
  useLayoutEffect(() => () => stopHeaderDrag.current?.(), []);
  function startHeaderRange(
    event: ReactPointerEvent<HTMLButtonElement>,
    first: string,
  ) {
    if (
      event.button !== 0 ||
      event.pointerType !== "mouse" ||
      interaction?.busy
    )
      return;
    stopHeaderDrag.current?.();
    suppressHeaderClick.current = true;
    interaction?.selectTime({ date: first });
    onSelectDay(
      first,
      event.shiftKey
        ? "extend"
        : event.metaKey || event.ctrlKey
          ? "toggle"
          : "replace",
    );
    const pointer = event.pointerId;
    const x = event.clientX;
    const y = event.clientY;
    let pointerX = x;
    let pointerY = y;
    let last = first;
    let selected = "";
    let moved = false;
    let frame = 0;
    const cleanup = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      stopHeaderDrag.current = null;
    };
    const updateTarget = (targetX: number, targetY: number) => {
      const heading = document
        .elementFromPoint(targetX, targetY)
        ?.closest<HTMLElement>(".grid-day-heading[data-date]");
      if (!heading?.dataset.date) return;
      last = heading.dataset.date;
      if (moved && selected !== last) {
        selected = last;
        onSelectRange(first, last);
      }
    };
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      pointerX = next.clientX;
      pointerY = next.clientY;
      if (!moved && Math.hypot(pointerX - x, pointerY - y) > 5) moved = true;
      if (moved) next.preventDefault();
      updateTarget(pointerX, pointerY);
    };
    const tick = () => {
      const viewport = scroll.current;
      const header = viewport?.querySelector<HTMLElement>(
        ".calendar-grid-head",
      );
      if (moved && viewport && header) {
        const bounds = viewport.getBoundingClientRect();
        const headerBounds = header.getBoundingClientRect();
        if (
          pointerY >= headerBounds.top &&
          pointerY <= headerBounds.bottom &&
          pointerX >= bounds.left &&
          pointerX <= bounds.right
        ) {
          const delta =
            pointerX > bounds.right - 35
              ? 14
              : pointerX < bounds.left + 85
                ? -14
                : 0;
          if (delta) {
            viewport.scrollLeft += delta;
            updateTarget(pointerX, pointerY);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      cleanup();
      if (moved) onSelectRange(first, last);
      window.setTimeout(() => {
        suppressHeaderClick.current = false;
      }, 0);
    };
    const cancel = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      cleanup();
      window.setTimeout(() => {
        suppressHeaderClick.current = false;
      }, 0);
    };
    stopHeaderDrag.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    frame = requestAnimationFrame(tick);
  }
  const days = week.days.filter((day) => view === "week" || day.date === date);
  const single = view === "day";
  const clockChange =
    single &&
    days.some(
      (day) => Date.parse(day.endsAt) - Date.parse(day.startsAt) !== 86400000,
    );
  const allDayPlansOnDate = (date: string) =>
    itemsOnDate(items, date, filter).filter((item) => item.kind === "all_day");
  const hasAllDay = days.some((day) => allDayPlansOnDate(day.date).length > 0);
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
                    if (suppressHeaderClick.current) {
                      suppressHeaderClick.current = false;
                      return;
                    }
                    interaction?.selectTime({ date });
                    onSelectDay(
                      date,
                      event.shiftKey
                        ? "extend"
                        : event.metaKey || event.ctrlKey
                          ? "toggle"
                          : "replace",
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
                        if (suppressHeaderClick.current) {
                          suppressHeaderClick.current = false;
                          return;
                        }
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
                      onDoubleClick={() => {
                        if (!suppressHeaderClick.current)
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
              {hasAllDay && (
                <div className="calendar-date-row calendar-all-day-row">
                  <span className="grid-zone">All day</span>
                  {days.map((day) => {
                    const plans = allDayPlansOnDate(day.date);
                    return (
                      <div key={day.date} className="calendar-anytime-cell">
                        {plans.slice(0, 1).map((item) => (
                          <CalendarItemButton
                            key={item.id}
                            item={item}
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
                : layoutDay(previewRecords, day).map((segment) => {
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
                      {visible.map(({ record, top, bottom, lane, lanes }) => {
                        const blockHeight = ((bottom - top) / 60) * hourHeight;
                        const bare = blockHeight < 15;
                        const tightTitle =
                          blockHeight >= 15 && blockHeight < 20;
                        const condensed = blockHeight < 42;
                        const canResize = blockHeight >= 28;
                        return (
                          <div
                            className={
                              "grid-record" +
                              (bare ? " is-bare" : "") +
                              (tightTitle ? " is-tight-title" : "") +
                              (condensed ? " is-condensed" : "") +
                              (blockHeight < 14 ? " is-tiny" : "")
                            }
                            key={record.kind + record.item.id}
                            style={{
                              top: (top / 60) * hourHeight,
                              height: blockHeight,
                              left: moments.length
                                ? `calc((100% - 44px) * ${lane / lanes})`
                                : (lane / lanes) * 100 + "%",
                              width: moments.length
                                ? `calc((100% - 44px) / ${lanes})`
                                : 100 / lanes + "%",
                            }}
                          >
                            {record.kind === "block" && canResize && (
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
                                    onDoubleClick={() =>
                                      onOpen(record, day.date)
                                    }
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
                                    onDoubleClick={() =>
                                      onOpen(record, day.date)
                                    }
                                  />
                                )}
                              </>
                            )}
                            <CalendarRecord
                              record={record}
                              week={week}
                              compact
                              date={day.date}
                              short={blockHeight < 66}
                              detailsOnInteraction={condensed}
                              onOpen={() => onOpen(record, day.date)}
                            />
                            {condensed && (
                              <div
                                className="grid-record-details"
                                aria-hidden="true"
                              >
                                <strong>{record.item.title}</strong>
                                <span>
                                  {formatTime(
                                    record.item.startsAt,
                                    week.timezone,
                                    true,
                                  )}{" "}
                                  -{" "}
                                  {formatTime(
                                    record.item.endsAt,
                                    week.timezone,
                                    true,
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
