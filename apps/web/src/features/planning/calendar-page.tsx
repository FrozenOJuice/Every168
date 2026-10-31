"use client";
import { features } from "@/lib/release";
import { calendarSchedulingSources } from "./calendar-scheduling";
import { CalendarSourceLink } from "./calendar-source-link";
import { CalendarDayFeed } from "./calendar-day-feed";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dateSchema,
  type SearchRecord,
  type CalendarItem,
} from "@168hours/contracts";
import {
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
import { CalendarInteractions } from "./calendar-interactions";
import { CalendarInteractionStatus } from "./calendar-interaction-status";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarGrid } from "./calendar-grid";
import { CalendarMonth } from "./calendar-month";
import { CalendarEditor } from "./calendar-editor";
import { CalendarDayRecords } from "./calendar-day-records";
import { CalendarClipboard } from "./calendar-clipboard";
import { CalendarContextMenus } from "./calendar-context-menu";
import { useCalendarZoom } from "./use-calendar-zoom";
import { useCalendarClock } from "./use-calendar-clock";
import type { CalendarScrollPosition } from "./calendar-grid";
import { useCalendar } from "./use-calendar";
import { useCalendarSelection } from "./use-calendar-selection";
import { calendarHref, HOUR_HEIGHT } from "./calendar-layout";
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
  const query = useCalendar(selected, view);
  const selection = useCalendarSelection(
    scope,
    query.blocks,
    query.items,
    preferences.timezone,
  );
  const {
    timeSelection: selectedTime,
    selectedDays,
    selectDay,
    selectDayRange,
    clearTime: clearTimeSelection,
  } = selection;
  const [overlay, setOverlay] = useState<CalendarOverlay | null>(null);
  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [filter, setFilter] = useState(emptyCalendarFilter);
  const [notice, setNotice] = useState("");
  const [listDate, setListDate] = useState<string | null>(null);
  const [listPortal, setListPortal] = useState<HTMLDialogElement | null>(null);
  const overlayContainer = listDate ? listPortal : null;
  const calendarSurface = useRef<HTMLDivElement>(null);
  const searchAnchor = useRef<HTMLButtonElement>(null);
  const scrollPosition = useRef<CalendarScrollPosition>({});
  const getScrollPosition = useCallback(() => scrollPosition.current, []);
  const saveScrollPosition = useCallback((position: CalendarScrollPosition) => {
    scrollPosition.current = position;
  }, []);
  const [scrollReset, setScrollReset] = useState(0);
  const {
    hourHeight,
    minimumHourHeight,
    visibleTickMinutes,
    changeMinimumHourHeight,
    changeHourHeight,
  } = useCalendarZoom({
    userId: user.id,
    view,
    unavailable: !!editor || !!overlay || !!listDate,
    calendarSurface,
    scrollPositionRef: scrollPosition,
  });
  const editorWeek = query.weeks.find(
    (week) => editor && week.days.some((day) => day.date === editor.date),
  );
  const listWeek = query.weeks.find((week) =>
    week.days.some((day) => day.date === listDate),
  );
  const visibleDraft =
    editor?.kind === "block" &&
    !editor.item &&
    !editor.allDayItem &&
    !editor.duplicateOf &&
    !editor.linkedBlock &&
    !editor.scheduledItem
      ? draft
      : null;
  function openRecord(record: CalendarDisplayRecord, date: string) {
    setNotice("");
    setListDate(null);
    if (record.kind === "item") {
      if (record.item.kind === "all_day") {
        setOverlay(null);
        setEditor({
          kind: "block",
          date,
          allDay: true,
          allDayItem: record.item,
        });
        return;
      }
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
    if (record.kind !== "item" || record.item.kind === "all_day")
      router.push(calendarHref(target, "day"), { scroll: false });
    setFilter(emptyCalendarFilter);
    openRecord(record, target);
  }
  return (
    <CalendarInteractions
      scope={scope}
      timezone={preferences.timezone}
      hourHeight={hourHeight}
      blocks={query.blocks}
      items={query.items}
      selection={selection}
      editorOpen={!!editor || !!overlay}
      overlayContainer={overlayContainer}
      onCreate={addGridRecord}
    >
      <CalendarClipboard
        userId={user.id}
        view={view}
        date={selected}
        selectedTime={selectedTime}
        selectedDays={selectedDays}
        weeks={query.weeks}
        items={query.items}
        unavailable={!!editor || !!overlay}
        feedbackContainer={overlayContainer}
      >
        <CalendarContextMenus
          date={selected}
          blocks={query.blocks}
          items={query.items}
          timezone={preferences.timezone}
          selectedDays={selectedDays}
          view={view}
          scope={scope}
          unavailable={!!editor || !!overlay || !query.complete}
          overlayContainer={overlayContainer}
          onSelectDay={selectDay}
          onAdd={(date, minute, allDay) => {
            if (allDay) addRecord(date, minute, undefined, false, true);
            else if (minute !== undefined) addGridRecord(date, minute);
            else addRecord(date);
          }}
          onOpen={openRecord}
          onTemplates={
            features.calendarTemplates
              ? () => {
                  setNotice("");
                  setOverlay({
                    mode: "templates",
                    date: selectedTime?.date ?? selected,
                  });
                }
              : undefined
          }
          onQuick={
            features.food
              ? () => {
                  setNotice("");
                  setOverlay({
                    mode: "quick",
                    date: selectedTime?.date ?? selected,
                    minute: selectedTime?.minute,
                  });
                }
              : undefined
          }
          onResetZoom={() => changeHourHeight(HOUR_HEIGHT)}
        >
          <div className="calendar-surface" ref={calendarSurface}>
            <CalendarToolbar
              date={selected}
              viewTargetDate={selectedTime?.date ?? selected}
              weekStart={query.selectedWeek}
              today={today}
              view={view}
              schedulingSources={calendarSchedulingSources}
              onScheduleSource={(sourceId) => {
                setNotice("");
                setDraft(null);
                setEditor(null);
                setListDate(null);
                setOverlay({
                  mode: "schedule-source",
                  sourceId,
                  date: selectedTime?.date ?? selected,
                  minute: selectedTime?.minute,
                });
              }}
              onAdd={() =>
                addRecord(selectedTime?.date ?? selected, selectedTime?.minute)
              }
              onSearch={() => {
                setNotice("");
                setOverlay((current) =>
                  current?.mode === "search" ? null : { mode: "search" },
                );
              }}
              searchAnchor={searchAnchor}
              searchOpen={overlay?.mode === "search"}
              filtered={
                !!(filter.q || filter.categoryId || filter.kind !== "all")
              }
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
            <CalendarInteractionStatus container={overlayContainer} />
            {(notice ||
              filter.q ||
              filter.categoryId ||
              filter.kind !== "all") && (
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
            {query.error && (
              <ErrorState error={query.error} retry={query.retry} />
            )}
            {query.isPending && <Loading />}
            {query.activityPending && (
              <p className="calendar-status" role="status">
                Loading activity…
              </p>
            )}
            {query.activityError && (
              <ErrorState
                error={query.activityError}
                retry={query.retryActivity}
              />
            )}
            {view !== "day" && !!query.activity?.truncatedSources.length && (
              <p className="calendar-status" role="status">
                Activity previews are limited in this range. Open a day to
                review a smaller range, or visit{" "}
                {query.activity.truncatedSources.map((source, index) => (
                  <span key={`${source.label}-${index}`}>
                    {index > 0 && ", "}
                    <CalendarSourceLink href={source.href}>
                      {source.label} history
                    </CalendarSourceLink>
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
                  onShowDay={setListDate}
                  selectedDays={selectedDays}
                  onSelectDay={selectDay}
                  onSelectRange={selectDayRange}
                />
              ) : (
                <div
                  className={
                    view === "day"
                      ? "calendar-day-layout"
                      : "calendar-week-layout"
                  }
                >
                  <CalendarGrid
                    draft={visibleDraft}
                    activity={query.activity?.entries ?? []}
                    week={query.week}
                    items={query.items}
                    filter={filter}
                    onOpenItem={(item) =>
                      openRecord({ kind: "item", item }, selected)
                    }
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
                    onSelectRange={selectDayRange}
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
              dialogRef={setListPortal}
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
              onDraftChange={setDraft}
              composer={
                !editor.item &&
                !editor.allDayItem &&
                !editor.duplicateOf &&
                !editor.linkedBlock &&
                !editor.scheduledItem
              }
              key={
                editor.kind +
                (editor.item?.id ??
                  editor.allDayItem?.id ??
                  editor.linkedBlock?.id ??
                  editor.fromItem?.id ??
                  (editor.duplicateOf
                    ? "copy-" + editor.duplicateOf.id
                    : "new"))
              }
              editor={editor}
              week={editorWeek}
              onClose={() => {
                setDraft(null);
                setEditor(null);
              }}
              onChange={setEditor}
              onRepeat={(block) => {
                setEditor(null);
                setOverlay({
                  mode: "series",
                  seriesSource: block,
                  date: selected,
                });
              }}
              onSeries={(seriesId) => {
                setEditor(null);
                setOverlay({
                  mode: "series",
                  seriesId,
                  occurrenceDate:
                    editor.allDayItem?.occurrenceDate ??
                    (editor.item && "occurrenceDate" in editor.item
                      ? (editor.item.occurrenceDate ?? undefined)
                      : undefined),
                });
              }}
              onSaved={(result) => {
                setDraft(null);
                setEditor(null);
                clearTimeSelection();
                setFilter(emptyCalendarFilter);
                if (result.kind === "all_day") {
                  setNotice("All-day plan saved.");
                  if (result.date !== selected)
                    router.push(calendarHref(result.date, view), {
                      scroll: false,
                    });
                  return;
                }
                const { startsAt, count } = result;
                if (count) setNotice(`${count} occurrences saved.`);
                if (
                  editor.item &&
                  Date.parse(startsAt) === Date.parse(editor.item.startsAt)
                )
                  return;
                const local = instantToLocalInput(
                  startsAt,
                  preferences.timezone,
                );
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
        </CalendarContextMenus>
      </CalendarClipboard>
    </CalendarInteractions>
  );
}
