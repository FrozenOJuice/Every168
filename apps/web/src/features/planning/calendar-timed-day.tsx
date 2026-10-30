import Link from "next/link";
import type { Week, CalendarActivity } from "@168hours/contracts";
import { instantToLocalInput, overlaps } from "@168hours/domain-utils";
import { formatTime } from "@/lib/format";
import { activityOnDate } from "./calendar-activity";
import { ActivityIcon } from "./calendar-day-feed";
import { CalendarHourSlot } from "./calendar-hour-slot";
import { CalendarRecord } from "./calendar-record";
import { useCalendarInteractions } from "./calendar-interactions";
import { currentHourMinute } from "./calendar-times";
import type { CalendarFilter } from "./calendar-filters";
import {
  calendarHref,
  dayRecords,
  layoutDay,
  visibleWeekSegments,
  type CalendarDraft,
  type CalendarRecord as Record,
  type TimeTickMinutes,
} from "./calendar-layout";
export function CalendarTimedDay({
  day,
  week,
  activity,
  filter,
  draft,
  single,
  today,
  now,
  nowMinute,
  hourHeight,
  tickMinutes,
  onOpen,
  onAdd,
  onQuickAction,
  onShowDay,
}: {
  day: Week["days"][number];
  week: Week;
  activity: CalendarActivity[];
  filter: CalendarFilter;
  draft?: CalendarDraft | null;
  single: boolean;
  today: string;
  now: string;
  nowMinute: number;
  hourHeight: number;
  tickMinutes: TimeTickMinutes;
  onOpen: (record: Record, date: string) => void;
  onAdd: (date: string, minute: number) => void;
  onQuickAction: (date: string, minute: number) => void;
  onShowDay: (date: string) => void;
}) {
  const interaction = useCalendarInteractions();
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
          instantToLocalInput(entry.occurredAt, week.timezone).slice(11, 13),
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
        (Date.parse(selection.startsAt) - Date.parse(day.startsAt)) / 60000,
      )
    : 0;
  const selectionBottom = selection
    ? Math.min(
        1440,
        (Date.parse(selection.endsAt) - Date.parse(day.startsAt)) / 60000,
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
            (Date.parse(resize.startsAt) - Date.parse(day.startsAt)) / 60000,
          ),
          bottom: Math.min(
            1440,
            (Date.parse(resize.endsAt) - Date.parse(day.startsAt)) / 60000,
          ),
        };
      });
  const visible = single ? segments : visibleWeekSegments(segments).visible;
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
                    currentHourMinute(new Date().toISOString(), week.timezone),
                  )
                }
              >
                Add block
              </button>
            </>
          ) : (
            <>
              <small>
                {records.length} records. Open this day for a clear view of
                every time.
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
                  instantToLocalInput(entry.occurredAt, week.timezone).slice(
                    11,
                    13,
                  ),
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
                {entries.length > 1 && <small>{entries.length}</small>}
              </button>
            );
          })}
          {visible.map(({ record, top, bottom, lane, lanes }) => {
            const blockHeight = ((bottom - top) / 60) * hourHeight;
            const bare = blockHeight < 15;
            const tightTitle = blockHeight >= 15 && blockHeight < 20;
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
                        aria-label={"Resize start of " + record.item.title}
                        onPointerDown={(event) =>
                          interaction?.start(
                            event,
                            "start",
                            record.item,
                            day.date,
                          )
                        }
                        onClick={() => interaction?.select(record.item.id)}
                        onDoubleClick={() => onOpen(record, day.date)}
                      />
                    )}
                    {Date.parse(record.item.endsAt) <=
                      Date.parse(day.endsAt) && (
                      <button
                        tabIndex={-1}
                        aria-hidden="true"
                        className="calendar-resize-handle resize-end"
                        aria-label={"Resize end of " + record.item.title}
                        onPointerDown={(event) =>
                          interaction?.start(
                            event,
                            "end",
                            record.item,
                            day.date,
                          )
                        }
                        onClick={() => interaction?.select(record.item.id)}
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
                  short={blockHeight < 66}
                  detailsOnInteraction={condensed}
                  onOpen={() => onOpen(record, day.date)}
                />
                {condensed && (
                  <div className="grid-record-details" aria-hidden="true">
                    <strong>{record.item.title}</strong>
                    <span>
                      {formatTime(record.item.startsAt, week.timezone, true)} -{" "}
                      {formatTime(record.item.endsAt, week.timezone, true)}
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
                height: ((selectionBottom - selectionTop) / 60) * hourHeight,
              }}
            >
              <strong>{draft?.title || "New plan"}</strong>
              <span>
                {formatTime(selection.startsAt, week.timezone)} -{" "}
                {formatTime(selection.endsAt, week.timezone)}
              </span>
              {interaction?.preview?.selection && <span>{day.date}</span>}
              {interaction?.preview?.selection && (
                <small className="calendar-drag-hint">Escape to cancel</small>
              )}
            </div>
          )}
          {day.date === today && (
            <div
              className="calendar-now"
              style={{ top: (nowMinute / 60) * hourHeight }}
              role="img"
              aria-label={
                "Current time: " + formatTime(now, week.timezone, true)
              }
            >
              <span aria-hidden="true">{formatTime(now, week.timezone)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
