import Link from "next/link";
import { useRouter } from "next/navigation";
import { activityOnDate } from "./calendar-activity";
import type { CalendarActivity } from "@168hours/contracts";
import { CalendarItemButton } from "./calendar-item-button";
import {
  itemsOnDate,
  type CalendarFilter,
  type CalendarDisplayRecord,
} from "./calendar-filters";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useCalendarInteractions } from "./calendar-interactions";
import type { Week, CalendarItem } from "@168hours/contracts";
import { formatDate, formatTime } from "@/lib/format";
import { overlaps } from "@168hours/domain-utils";
import { CalendarRecord } from "./calendar-record";
import {
  calendarHref,
  dayRecords,
  type CalendarDraft,
} from "./calendar-layout";

export function CalendarMonth({
  draft,
  weeks,
  activity,
  date,
  today,
  onOpen,
  onShowDay,
  selectedDays,
  onSelectDay,
  onSelectRange,
  items,
  filter,
}: {
  draft?: CalendarDraft | null;
  weeks: Week[];
  activity: CalendarActivity[];
  date: string;
  today: string;
  onOpen: (record: CalendarDisplayRecord, date: string) => void;
  items: CalendarItem[];
  filter: CalendarFilter;
  onShowDay: (date: string) => void;
  selectedDays: string[];
  onSelectDay: (date: string, mode?: "replace" | "toggle" | "extend") => void;
  onSelectRange: (first: string, last: string) => void;
}) {
  const router = useRouter();
  const interaction = useCalendarInteractions();
  const cells = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  function startRange(
    event: ReactPointerEvent<HTMLButtonElement>,
    first: string,
  ) {
    if (
      event.button !== 0 ||
      event.pointerType !== "mouse" ||
      interaction?.busy
    )
      return;
    suppressClick.current = true;

    onSelectDay(first, interaction?.daySelectionMode(event) ?? "replace");
    const pointer = event.pointerId;
    const x = event.clientX;
    const y = event.clientY;
    let last = first;
    let moved = false;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      const cell = document
        .elementFromPoint(next.clientX, next.clientY)
        ?.closest<HTMLElement>(".month-day[data-date]");
      if (!cell?.dataset.date) return;
      last = cell.dataset.date;
      if (!moved && Math.hypot(next.clientX - x, next.clientY - y) > 5)
        moved = true;
      if (moved) {
        next.preventDefault();
        onSelectRange(first, last);
      }
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      cleanup();
      if (moved) onSelectRange(first, last);
    };
    const cancel = (next: PointerEvent) => {
      if (next.pointerId === pointer) cleanup();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
  }
  const [capacity, setCapacity] = useState({
    slots: 0,
    compact: true,
    inline: false,
  });
  useEffect(() => {
    const element = cells.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect.width / 7;
      const height = entry.contentRect.height / weeks.length;
      const compact = width < 96;
      const inline = height < 58;
      const coarse = matchMedia("(pointer: coarse)").matches;
      const rowHeight = coarse ? 24 : 20;
      const slots =
        compact || inline
          ? 0
          : Math.max(
              0,
              Math.min(
                4,
                Math.floor((height - (coarse ? 33 : 31) + 1) / (rowHeight + 1)),
              ),
            );
      setCapacity((current) =>
        current.slots === slots &&
        current.compact === compact &&
        current.inline === inline
          ? current
          : { slots, compact, inline },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [weeks.length]);
  return (
    <section className="calendar-month" aria-label="Monthly calendar">
      <div className="month-head" aria-hidden="true">
        {weeks[0]?.days.map((day) => (
          <span key={day.date}>
            {formatDate(day.date, { weekday: "short" })}
          </span>
        ))}
      </div>
      <div
        ref={cells}
        className={
          "month-days" +
          (capacity.compact ? " compact-month" : "") +
          (capacity.inline ? " short-rows" : "")
        }
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.flatMap((week) =>
          week.days.map((day) => {
            const records: CalendarDisplayRecord[] = [
              ...itemsOnDate(
                items.map((item) =>
                  interaction?.preview?.dateResize?.id === item.id
                    ? interaction.preview.dateResize
                    : item,
                ),
                day.date,
                filter,
              ).map((item) => ({
                kind: "item" as const,
                item,
              })),
              ...dayRecords(week, day.date, filter),
            ];
            const moments = activityOnDate(
              activity,
              day.date,
              week.timezone,
              filter,
            ).filter(
              (entry) => entry.kind === "moment" || entry.kind === "task",
            );
            const count = records.length + moments.length;
            const limit =
              records.length > capacity.slots
                ? Math.max(0, capacity.slots - 1)
                : capacity.slots;
            const previews = records.slice(0, limit);
            const hidden = capacity.inline
              ? count
              : records.length - previews.length;
            const more =
              hidden > 0 ? (
                <Link
                  className={
                    "month-more" + (capacity.inline ? " month-more-inline" : "")
                  }
                  aria-label={`Day view for ${day.date}, ${hidden} more records`}
                  href={calendarHref(day.date, "day")}
                  scroll={false}
                >
                  +{hidden}
                  {!capacity.inline && " more"}
                </Link>
              ) : null;
            return (
              <div
                key={day.date}
                data-date={day.date}
                data-drop-date={day.date}
                className={
                  "month-day" +
                  (selectedDays.includes(day.date) ? " is-selected" : "") +
                  (day.date.slice(0, 7) !== date.slice(0, 7)
                    ? " outside-month"
                    : "") +
                  (day.date === today ? " is-today" : "")
                }
              >
                <button
                  className="month-select-day"
                  aria-label={`Select ${day.date}, ${count} records`}
                  aria-pressed={selectedDays.includes(day.date)}
                  onPointerDown={(event) => startRange(event, day.date)}
                  onClick={(event) => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }

                    onSelectDay(
                      day.date,
                      interaction?.daySelectionMode(event) ?? "replace",
                    );
                  }}
                  onDoubleClick={() => {
                    if (!interaction?.busy && !interaction?.multiSelect)
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
                />
                <div className="month-day-heading">
                  <span className="month-date" aria-hidden="true">
                    <strong>{formatDate(day.date, { day: "numeric" })}</strong>
                  </span>
                  {capacity.inline && more}
                  {!capacity.inline && moments.length > 0 && (
                    <button
                      className="text-button calendar-moment-count"
                      onClick={() => onShowDay(day.date)}
                      aria-label={"Show moments for " + day.date}
                    >
                      {moments.length}
                      <span className="month-moment-label">
                        {" "}
                        {moments.some((e) => e.kind === "task")
                          ? "tasks / moments"
                          : "moments"}
                      </span>
                    </button>
                  )}
                </div>
                <div className="month-previews">
                  {previews.map((record) => (
                    <div
                      className="month-preview"
                      key={record.kind + record.item.id}
                    >
                      {record.kind === "item" ? (
                        <CalendarItemButton
                          compact
                          item={record.item}
                          date={day.date}
                          onOpen={() => onOpen(record, day.date)}
                        />
                      ) : (
                        <CalendarRecord
                          record={record}
                          week={week}
                          compact
                          month
                          date={day.date}
                          short
                          onOpen={() => onOpen(record, day.date)}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {!capacity.inline && more}
                {draft && overlaps(draft, day) && (
                  <div
                    className="calendar-draft-card"
                    data-calendar-draft={day.date}
                    role="img"
                    aria-label={`Draft plan: ${draft.title || "New plan"}`}
                  >
                    <strong>{draft.title || "New plan"}</strong>
                    <span>{formatTime(draft.startsAt, week.timezone)}</span>
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
