import { useCalendarInteractions } from "./calendar-interactions";
import { CalendarItemButton } from "./calendar-item-button";
import {
  itemsOnDate,
  type CalendarFilter,
  type CalendarDisplayRecord,
} from "./calendar-filters";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Week, CalendarItem } from "@168hours/contracts";
import { formatDate } from "@/lib/format";
import { CalendarRecord } from "./calendar-record";
import { calendarHref, dayRecords } from "./calendar-layout";

export function CalendarMonth({
  weeks,
  date,
  today,
  onOpen,
  onAdd,
  onShowDay,
  items,
  filter,
}: {
  weeks: Week[];
  date: string;
  today: string;
  onOpen: (record: CalendarDisplayRecord, date: string) => void;
  items: CalendarItem[];
  filter: CalendarFilter;
  onAdd: (date: string) => void;
  onShowDay: (date: string) => void;
}) {
  const interaction = useCalendarInteractions();
  const cells = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState({ previews: 0, compact: false });
  useEffect(() => {
    if (!cells.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const compact = entry.contentRect.width / 7 < 100;
      const previews = compact
        ? 0
        : Math.max(
            0,
            Math.min(
              3,
              Math.floor((entry.contentRect.height / weeks.length - 48) / 46),
            ),
          );
      setCapacity((current) =>
        current.previews === previews && current.compact === compact
          ? current
          : { previews, compact },
      );
    });
    observer.observe(cells.current);
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
        className="month-days"
        ref={cells}
        style={{
          gridTemplateRows: `repeat(${weeks.length}, minmax(52px, 1fr))`,
          minHeight: weeks.length * 52,
        }}
      >
        {weeks.flatMap((week) =>
          week.days.map((day) => {
            const records: CalendarDisplayRecord[] = [
              ...itemsOnDate(items, day.date, filter).map((item) => ({
                kind: "item" as const,
                item,
              })),
              ...dayRecords(week, day.date, filter),
            ];
            const previews = records.slice(0, capacity.previews);
            const hidden = records.length - previews.length;
            return (
              <div
                key={day.date}
                data-date={day.date}
                data-drop-date={day.date}
                className={
                  "month-day" +
                  (day.date.slice(0, 7) !== date.slice(0, 7)
                    ? " outside-month"
                    : "") +
                  (day.date === today ? " is-today" : "") +
                  (interaction?.preview?.point.date === day.date
                    ? " is-drag-target"
                    : "")
                }
              >
                {capacity.compact ? (
                  <button
                    className="month-compact-day"
                    aria-label={`Show ${records.length} records for ${day.date}`}
                    onClick={() => onShowDay(day.date)}
                  >
                    <strong>{formatDate(day.date, { day: "numeric" })}</strong>
                    {records.length > 0 && (
                      <span>
                        +{records.length}
                        <span className="sr-only"> more</span>
                      </span>
                    )}
                  </button>
                ) : (
                  <>
                    <div className="month-day-heading">
                      <Link
                        className="month-date"
                        href={calendarHref(day.date, "day")}
                        scroll={false}
                        aria-label={`Day view for ${day.date}, ${records.length} records`}
                      >
                        <strong>
                          {formatDate(day.date, { day: "numeric" })}
                        </strong>
                      </Link>
                      {hidden > 0 && (
                        <button
                          className="month-more"
                          aria-label={`Show all records for ${day.date}, ${hidden} more`}
                          onClick={() => onShowDay(day.date)}
                        >
                          +{hidden} more
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
                              onOpen={() => onOpen(record, day.date)}
                            />
                          ) : (
                            <CalendarRecord
                              record={record}
                              week={week}
                              compact
                              date={day.date}
                              short
                              onOpen={() => onOpen(record, day.date)}
                            />
                          )}
                        </div>
                      ))}
                      {!records.length && capacity.previews > 0 && (
                        <button
                          className="month-add"
                          aria-label={"Add block on " + day.date}
                          onClick={() => onAdd(day.date)}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
