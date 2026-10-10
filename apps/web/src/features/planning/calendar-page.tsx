"use client";
import { CalendarDayFeed } from "./calendar-day-feed";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dateSchema,
  type SearchRecord,
  type CalendarItem,
} from "@168hours/contracts";
import {
  addDays,
  daysBetween,
  instantToLocalInput,
  localDate,
  localInputToInstant,
} from "@168hours/domain-utils";
import { currentHourMinute, editorTimes } from "./calendar-times";
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
import type { TimeScaleAnchor } from "./calendar-time-axis";
import { CalendarMonth } from "./calendar-month";
import { CalendarEditor } from "./calendar-editor";
import { CalendarDayRecords } from "./calendar-day-records";
import { CalendarClipboard } from "./calendar-clipboard";
import { useCalendarClock } from "./use-calendar-clock";
import type { CalendarScrollPosition } from "./calendar-grid";
import { useCalendar } from "./use-calendar";
import {
  calendarHref,
  HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  timeScaleScrollTop,
  timeTickMinutes,
  type TimeTickMinutes,
} from "./calendar-layout";
import type {
  CalendarView,
  TimeEditor,
  CalendarDraft,
} from "./calendar-layout";

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
  const { preferences, user } = useMe();
  const router = useRouter();
  const now = useCalendarClock(initialNow);
  const today = localDate(now, preferences.timezone);
  const selected = dateSchema.safeParse(date).success ? date! : today;
  const view: CalendarView =
    requestedView === "month" || requestedView === "day"
      ? requestedView
      : "week";
  const [editor, setEditor] = useState<TimeEditor | null>(
    add
      ? {
          kind: "block",
          date: selected,
          minute: currentHourMinute(now, preferences.timezone),
        }
      : null,
  );
  const scope = `${view}:${selected}`;
  const [timeSelection, setTimeSelection] = useState<{
    scope: string;
    point: { date: string; minute?: number } | null;
  }>({ scope, point: null });
  if (timeSelection.scope !== scope) setTimeSelection({ scope, point: null });
  const selectedTime =
    timeSelection.scope === scope ? timeSelection.point : null;
  const [daySelection, setDaySelection] = useState<{
    scope: string;
    dates: string[];
    anchor: string | null;
  }>({ scope, dates: [], anchor: null });
  if (daySelection.scope !== scope)
    setDaySelection({ scope, dates: [], anchor: null });
  const selectedDays = daySelection.scope === scope ? daySelection.dates : [];
  function selectDay(
    date: string,
    mode: "replace" | "toggle" | "extend" = "replace",
  ) {
    setDaySelection((current) => {
      const active =
        current.scope === scope ? current : { scope, dates: [], anchor: null };
      if (mode === "toggle") {
        const dates = active.dates.includes(date)
          ? active.dates.filter((value) => value !== date)
          : [...active.dates, date].sort();
        return { scope, dates, anchor: active.anchor ?? date };
      }
      if (mode === "extend" && active.anchor) {
        const first = active.anchor < date ? active.anchor : date;
        const last = active.anchor < date ? date : active.anchor;
        const dates = Array.from(
          { length: daysBetween(first, last) + 1 },
          (_, index) => addDays(first, index),
        );
        return { scope, dates, anchor: active.anchor };
      }
      return { scope, dates: [date], anchor: date };
    });
  }
  function selectDayRange(first: string, last: string) {
    const start = first < last ? first : last;
    const end = first < last ? last : first;
    setTimeSelection({ scope, point: { date: start } });
    setDaySelection({
      scope,
      anchor: first,
      dates: Array.from({ length: daysBetween(start, end) + 1 }, (_, index) =>
        addDays(start, index),
      ),
    });
  }
  function clearTimeSelection() {
    setTimeSelection({ scope, point: null });
  }
  const [overlay, setOverlay] = useState<CalendarOverlay | null>(null);
  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [filter, setFilter] = useState(emptyCalendarFilter);
  const [notice, setNotice] = useState("");
  const [listDate, setListDate] = useState<string | null>(null);
  const calendarSurface = useRef<HTMLDivElement>(null);
  const searchAnchor = useRef<HTMLButtonElement>(null);
  const scrollPosition = useRef<CalendarScrollPosition>({});
  const getScrollPosition = useCallback(() => scrollPosition.current, []);
  const saveScrollPosition = useCallback((position: CalendarScrollPosition) => {
    scrollPosition.current = position;
  }, []);
  const [scrollReset, setScrollReset] = useState(0);
  const [savedHourHeight, setSavedHourHeight] = useState(HOUR_HEIGHT);
  const [minimumHourHeight, setMinimumHourHeight] = useState(MIN_HOUR_HEIGHT);
  const hourHeight = Math.max(savedHourHeight, minimumHourHeight);
  const [tickMinutes, setTickMinutes] = useState<TimeTickMinutes>(60);
  const visibleTickMinutes = timeTickMinutes(tickMinutes, hourHeight);
  const changeMinimumHourHeight = useCallback((height: number) => {
    setMinimumHourHeight(Math.max(MIN_HOUR_HEIGHT, height));
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = Number(
          localStorage.getItem(`calendar-hour-height:${user.id}`),
        );
        if (
          !Number.isInteger(stored) ||
          stored < MIN_HOUR_HEIGHT ||
          stored > MAX_HOUR_HEIGHT
        )
          return;
        scrollPosition.current.top =
          (scrollPosition.current.top ?? 0) * (stored / HOUR_HEIGHT);
        setSavedHourHeight(stored);
        const savedTicks = Number(
          localStorage.getItem(`calendar-time-ticks:${user.id}`),
        );
        setTickMinutes(
          timeTickMinutes(
            savedTicks === 15 ||
              savedTicks === 30 ||
              savedTicks === 120 ||
              savedTicks === 240
              ? savedTicks
              : 60,
            stored,
          ),
        );
      } catch {
        // Browser storage is optional; the default scale remains usable.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [user.id]);
  const changeHourHeight = useCallback(
    (next: number, anchor?: TimeScaleAnchor) => {
      const fitted = next <= minimumHourHeight;
      const stored = fitted ? MIN_HOUR_HEIGHT : next;
      if (stored === savedHourHeight) return;
      const nextTicks = timeTickMinutes(visibleTickMinutes, next);
      scrollPosition.current.top = anchor
        ? timeScaleScrollTop(anchor, next, minimumHourHeight)
        : ((scrollPosition.current.top ?? 0) * next) / hourHeight;
      setSavedHourHeight(stored);
      setTickMinutes(nextTicks);
      try {
        localStorage.setItem(`calendar-hour-height:${user.id}`, String(stored));
        localStorage.setItem(
          `calendar-time-ticks:${user.id}`,
          String(nextTicks),
        );
      } catch {
        // Keep the current scale even when browser storage is unavailable.
      }
    },
    [
      hourHeight,
      minimumHourHeight,
      savedHourHeight,
      user.id,
      visibleTickMinutes,
    ],
  );
  useEffect(() => {
    if (view === "month") return;
    const resetHourSpacing = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "r" ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        editor ||
        overlay ||
        listDate ||
        (event.target instanceof Element &&
          (event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="menu"]',
          ) ||
            (event.target !== document.body &&
              !calendarSurface.current?.contains(event.target))))
      )
        return;
      event.preventDefault();
      changeHourHeight(HOUR_HEIGHT);
    };
    window.addEventListener("keydown", resetHourSpacing);
    return () => window.removeEventListener("keydown", resetHourSpacing);
  }, [view, editor, overlay, listDate, changeHourHeight]);
  const query = useCalendar(selected, view);
  const editorWeek = query.weeks.find(
    (week) => editor && week.days.some((day) => day.date === editor.date),
  );
  const listWeek = query.weeks.find((week) =>
    week.days.some((day) => day.date === listDate),
  );
  const visibleDraft =
    editor?.kind === "block" &&
    !editor.item &&
    !editor.duplicateOf &&
    !editor.linkedBlock &&
    !editor.scheduledItem
      ? draft
      : null;
  function openRecord(record: CalendarDisplayRecord, date: string) {
    setNotice("");
    setListDate(null);
    if (record.kind === "item") {
      setOverlay({ mode: record.item.kind, item: record.item, date });
      return;
    }
    setOverlay(null);
    setEditor({ ...record, date });
  }
  function addRecord(
    date: string,
    minute?: number,
    durationMinutes?: number,
    repeat = false,
    allDay = false,
  ) {
    setDraft(null);
    setNotice("");
    setListDate(null);
    clearTimeSelection();
    setEditor({
      kind: "block",
      date,
      minute:
        minute ??
        currentHourMinute(new Date().toISOString(), preferences.timezone),
      durationMinutes,
      repeat,
      allDay,
    });
  }
  function schedule(item: CalendarItem) {
    setOverlay(null);
    setEditor({ kind: "block", date: selected, scheduledItem: item });
  }
  function addTime(item: CalendarItem, date: string) {
    setOverlay(null);
    setDraft(null);
    setEditor({
      kind: "block",
      date,
      minute: currentHourMinute(new Date().toISOString(), preferences.timezone),
      fromItem: item,
    });
  }
  function addGridRecord(
    date: string,
    minute: number,
    durationMinutes?: number,
  ) {
    const day = query.weeks
      .flatMap((week) => week.days)
      .find((day) => day.date === date);
    if (
      !day ||
      Date.parse(day.endsAt) - Date.parse(day.startsAt) !== 86400000
    ) {
      addRecord(date, minute, durationMinutes);
      return;
    }
    clearTimeSelection();
    const next: TimeEditor = {
      kind: "block",
      date,
      minute,
      durationMinutes,
    };
    const times = editorTimes(next, preferences.timezone);
    const startsAt = localInputToInstant(times.startsAt, preferences.timezone);
    setDraft({
      title: "",
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + times.duration).toISOString(),
    });
    setNotice("");
    setListDate(null);
    setEditor(next);
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
    <CalendarInteractions
      timezone={preferences.timezone}
      hourHeight={hourHeight}
      blocks={query.weeks.flatMap((week) => week.blocks)}
      timeSelection={selectedTime}
      onSelectTime={(point) => setTimeSelection({ scope, point })}
      onClearTimeSelection={clearTimeSelection}
      editorOpen={!!editor || !!overlay || !!listDate}
      onCreate={addGridRecord}
    >
      <CalendarClipboard
        userId={user.id}
        view={view}
        date={selected}
        selectedTime={selectedTime}
        selectedDays={selectedDays}
        weeks={query.weeks}
        unavailable={!!editor || !!overlay || !!listDate}
      />
      <div className="calendar-surface" ref={calendarSurface}>
        <CalendarToolbar
          date={selected}
          viewTargetDate={selectedTime?.date ?? selected}
          weekStart={query.selectedWeek}
          today={today}
          view={view}
          onAdd={() =>
            addRecord(selectedTime?.date ?? selected, selectedTime?.minute)
          }
          onTools={() => {
            setNotice("");
            setOverlay({ mode: "tools" });
          }}
          onSearch={() => {
            setNotice("");
            setOverlay((current) =>
              current?.mode === "search" ? null : { mode: "search" },
            );
          }}
          searchAnchor={searchAnchor}
          searchOpen={overlay?.mode === "search"}
          filtered={!!(filter.q || filter.categoryId || filter.kind !== "all")}
          onToday={() => {
            clearTimeSelection();
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
        {query.activityPending && (
          <p className="calendar-status" role="status">
            Loading activity…
          </p>
        )}
        {query.activityError && (
          <ErrorState error={query.activityError} retry={query.retryActivity} />
        )}
        {view !== "day" && !!query.activity?.truncatedSources.length && (
          <p className="calendar-status" role="status">
            Activity previews are limited in this range. Open a day to review a
            smaller range, or visit{" "}
            {query.activity.truncatedSources.map((source, index) => (
              <span key={`${source.label}-${index}`}>
                {index > 0 && ", "}
                <a href={source.href}>{source.label} history</a>
              </span>
            ))}
            .
          </p>
        )}
        {query.complete &&
          query.week &&
          (view === "month" ? (
            <CalendarMonth
              draft={visibleDraft}
              activity={query.activity?.entries ?? []}
              weeks={query.weeks}
              items={query.items}
              filter={filter}
              date={selected}
              today={today}
              onOpen={openRecord}
              onAdd={addRecord}
              onShowDay={setListDate}
              selectedDays={selectedDays}
              onSelectDay={selectDay}
              onSelectRange={selectDayRange}
            />
          ) : (
            <div
              className={
                view === "day" ? "calendar-day-layout" : "calendar-week-layout"
              }
            >
              <CalendarGrid
                draft={visibleDraft}
                activity={query.activity?.entries ?? []}
                week={query.week}
                items={query.items}
                filter={filter}
                onOpenItem={(item) => setOverlay({ mode: item.kind, item })}
                date={selected}
                today={today}
                view={view}
                onOpen={openRecord}
                onAdd={addGridRecord}
                onQuickAction={(date, minute) =>
                  setOverlay({ mode: "quick", date, minute })
                }
                onShowDay={setListDate}
                selectedDays={selectedDays}
                onSelectDay={selectDay}
                now={now}
                hourHeight={hourHeight}
                minimumHourHeight={minimumHourHeight}
                tickMinutes={visibleTickMinutes}
                onHourHeightChange={changeHourHeight}
                onMinimumHourHeightChange={changeMinimumHourHeight}
                getScrollPosition={getScrollPosition}
                saveScrollPosition={saveScrollPosition}
                scrollReset={scrollReset}
              />
              {view === "day" && query.activity && (
                <CalendarDayFeed
                  date={selected}
                  week={query.week}
                  items={query.items}
                  activity={query.activity}
                  filter={filter}
                  now={now}
                  onOpen={openRecord}
                />
              )}
            </div>
          ))}
      </div>
      {listDate && listWeek && (
        <CalendarDayRecords
          date={listDate}
          now={now}
          week={listWeek}
          items={query.items}
          filter={filter}
          onClose={() => setListDate(null)}
          onOpen={openRecord}
        />
      )}
      {overlay && (
        <CalendarOverlays
          overlay={overlay}
          setOverlay={setOverlay}
          date={overlay.date ?? selected}
          filter={filter}
          onFilter={setFilter}
          onOpen={openSearch}
          searchAnchor={searchAnchor}
          onAddRepeating={() =>
            addRecord(
              selectedTime?.date ?? selected,
              selectedTime?.minute,
              undefined,
              true,
            )
          }
          onAddAllDay={() =>
            addRecord(
              selectedTime?.date ?? selected,
              selectedTime?.minute,
              undefined,
              false,
              true,
            )
          }
          onSchedule={schedule}
          onAddTime={addTime}
          onCopyItem={(item) => {
            setOverlay({ mode: "copy", sourceId: item.id, sourceKind: "item" });
          }}
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
          onDraftChange={setDraft}
          composer={
            !editor.item &&
            !editor.duplicateOf &&
            !editor.linkedBlock &&
            !editor.scheduledItem
          }
          key={
            editor.kind +
            (editor.item?.id ??
              editor.linkedBlock?.id ??
              editor.fromItem?.id ??
              (editor.duplicateOf ? "copy-" + editor.duplicateOf.id : "new"))
          }
          editor={editor}
          week={editorWeek}
          onClose={() => {
            setDraft(null);
            setEditor(null);
          }}
          onChange={setEditor}
          onSeries={(seriesId) => {
            setEditor(null);
            setOverlay({ mode: "series", seriesId });
          }}
          onCopy={(sourceId) => {
            setEditor(null);
            setOverlay({ mode: "copy", sourceId });
          }}
          onSaved={(result) => {
            setDraft(null);
            setEditor(null);
            clearTimeSelection();
            setFilter(emptyCalendarFilter);
            if (result.kind === "all_day") {
              setNotice("All-day plan saved.");
              if (result.date !== selected)
                router.push(calendarHref(result.date, view), { scroll: false });
              return;
            }
            const { startsAt, count } = result;
            if (count) setNotice(`${count} occurrences saved.`);
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
                  hourHeight,
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
