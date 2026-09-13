"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dateSchema,
  type SearchRecord,
  type CalendarItem,
} from "@168hours/contracts";
import { instantToLocalInput, localDate } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { CalendarOverlays, type CalendarOverlay } from "./calendar-overlays";
import {
  emptyCalendarFilter,
  type CalendarDisplayRecord,
} from "./calendar-filters";
import {
  CalendarInteractions,
  CalendarInteractionStatus,
} from "./calendar-interactions";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarGrid } from "./calendar-grid";
import { CalendarMonth } from "./calendar-month";
import { CalendarEditor } from "./calendar-editor";
import { CalendarDayRecords } from "./calendar-day-records";
import { useCalendarClock } from "./use-calendar-clock";
import type { CalendarScrollPosition } from "./calendar-grid";
import { useCalendar } from "./use-calendar";
import { calendarHref, HOUR_HEIGHT } from "./calendar-layout";
import type { CalendarView, TimeEditor } from "./calendar-layout";

export function CalendarPage({
  initialNow,
  date,
  view: requestedView,
  add = false,
}: {
  initialNow: string;
  date?: string;
  view?: string;
  add?: boolean;
}) {
  const { preferences } = useMe();
  const router = useRouter();
  const now = useCalendarClock(initialNow);
  const today = localDate(now, preferences.timezone);
  const selected = dateSchema.safeParse(date).success ? date! : today;
  const view: CalendarView =
    requestedView === "month" || requestedView === "day"
      ? requestedView
      : "week";
  const [editor, setEditor] = useState<TimeEditor | null>(
    add ? { kind: "block", date: selected } : null,
  );
  const [overlay, setOverlay] = useState<CalendarOverlay | null>(null);
  const [filter, setFilter] = useState(emptyCalendarFilter);
  const [notice, setNotice] = useState("");
  const [listDate, setListDate] = useState<string | null>(null);
  const scrollPosition = useRef<CalendarScrollPosition>({});
  const getScrollPosition = useCallback(() => scrollPosition.current, []);
  const saveScrollPosition = useCallback((position: CalendarScrollPosition) => {
    scrollPosition.current = position;
  }, []);
  const [scrollReset, setScrollReset] = useState(0);
  const query = useCalendar(selected, view);
  const editorWeek = query.weeks.find(
    (week) => editor && week.days.some((day) => day.date === editor.date),
  );
  const listWeek = query.weeks.find((week) =>
    week.days.some((day) => day.date === listDate),
  );
  function openRecord(record: CalendarDisplayRecord, date: string) {
    setNotice("");
    setListDate(null);
    if (record.kind === "item") {
      setOverlay({ mode: record.item.kind, item: record.item });
      return;
    }
    setOverlay(null);
    setEditor({ ...record, date });
  }
  function addRecord(date: string, minute?: number, durationMinutes?: number) {
    setNotice("");
    setListDate(null);
    setEditor({ kind: "block", date, minute, durationMinutes });
  }
  function schedule(item: CalendarItem) {
    setOverlay(null);
    setEditor({ kind: "block", date: selected, scheduledItem: item });
  }
  function openSearch(record: SearchRecord) {
    const target =
      record.kind === "item"
        ? (record.item.date ?? selected)
        : localDate(record.item.startsAt, preferences.timezone);
    if (record.kind !== "item")
      router.push(calendarHref(target, "day"), { scroll: false });
    setFilter(emptyCalendarFilter);
    openRecord(record, target);
  }
  return (
    <CalendarInteractions timezone={preferences.timezone} onCreate={addRecord}>
      <div className="calendar-surface">
        <CalendarToolbar
          date={selected}
          weekStart={query.selectedWeek}
          today={today}
          view={view}
          onAdd={() => addRecord(selected)}
          onTools={() => {
            setNotice("");
            setOverlay({ mode: "tools" });
          }}
          onSearch={() => {
            setNotice("");
            setOverlay({ mode: "search" });
          }}
          filtered={!!(filter.q || filter.categoryId || filter.kind !== "all")}
          onToday={() => {
            scrollPosition.current =
              view === "month" ? {} : { focusDate: today };
            setScrollReset((value) => value + 1);
          }}
          onJump={(date) => {
            scrollPosition.current.weekLeft = undefined;
            scrollPosition.current.focusDate =
              view === "month" ? undefined : date;
          }}
        />
        <CalendarInteractionStatus />
        <div className="calendar-caption">
          <div className="calendar-legend">
            <span>
              <i className="legend-planned" aria-hidden="true" />
              Planned
            </span>
            <span>
              <i className="legend-recorded" aria-hidden="true" />
              Recorded
            </span>
          </div>
          <span>{preferences.timezone.replaceAll("_", " ")}</span>
        </div>
        {(notice || filter.q || filter.categoryId || filter.kind !== "all") && (
          <div className="calendar-status" role="status">
            <span>{notice || "Calendar filtered"}</span>
            <button
              className="text-button"
              onClick={() => {
                setNotice("");
                setFilter(emptyCalendarFilter);
              }}
            >
              Clear
            </button>
          </div>
        )}
        {query.error && <ErrorState error={query.error} retry={query.retry} />}
        {query.isPending && <Loading />}
        {query.complete &&
          query.week &&
          (view === "month" ? (
            <CalendarMonth
              weeks={query.weeks}
              items={query.items}
              filter={filter}
              date={selected}
              today={today}
              onOpen={openRecord}
              onAdd={addRecord}
              onShowDay={setListDate}
            />
          ) : (
            <CalendarGrid
              week={query.week}
              items={query.items}
              filter={filter}
              onOpenItem={(item) => setOverlay({ mode: item.kind, item })}
              date={selected}
              today={today}
              view={view}
              onOpen={openRecord}
              onAdd={addRecord}
              onShowDay={setListDate}
              now={now}
              getScrollPosition={getScrollPosition}
              saveScrollPosition={saveScrollPosition}
              scrollReset={scrollReset}
            />
          ))}
      </div>
      {listDate && listWeek && (
        <CalendarDayRecords
          date={listDate}
          week={listWeek}
          items={query.items}
          filter={filter}
          onClose={() => setListDate(null)}
          onOpen={openRecord}
          onAdd={addRecord}
        />
      )}
      {overlay && (
        <CalendarOverlays
          overlay={overlay}
          setOverlay={setOverlay}
          date={selected}
          filter={filter}
          onFilter={setFilter}
          onOpen={openSearch}
          onSchedule={schedule}
          onSaved={(message, target) => {
            setOverlay(null);
            setNotice(message);
            setFilter(emptyCalendarFilter);
            if (target)
              router.push(calendarHref(target, view), { scroll: false });
          }}
        />
      )}
      {editor && editorWeek && (
        <CalendarEditor
          key={
            editor.kind +
            (editor.item?.id ??
              editor.linkedBlock?.id ??
              (editor.duplicateOf ? "copy-" + editor.duplicateOf.id : "new"))
          }
          editor={editor}
          week={editorWeek}
          onClose={() => setEditor(null)}
          onChange={setEditor}
          onSeries={(seriesId) => {
            setEditor(null);
            setOverlay({ mode: "series", seriesId });
          }}
          onSaved={(startsAt) => {
            setEditor(null);
            setFilter(emptyCalendarFilter);
            if (
              editor.item &&
              Date.parse(startsAt) === Date.parse(editor.item.startsAt)
            )
              return;
            const local = instantToLocalInput(startsAt, preferences.timezone);
            scrollPosition.current = {
              focusDate: view === "month" ? undefined : local.slice(0, 10),
              top: Math.max(
                0,
                (Number(local.slice(11, 13)) +
                  Number(local.slice(14, 16)) / 60 -
                  1) *
                  HOUR_HEIGHT,
              ),
            };
            setScrollReset((value) => value + 1);
            if (local.slice(0, 10) !== selected)
              router.push(calendarHref(local.slice(0, 10), view), {
                scroll: false,
              });
          }}
        />
      )}
    </CalendarInteractions>
  );
}
