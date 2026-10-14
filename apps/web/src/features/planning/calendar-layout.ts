import { matchesCalendar, type CalendarFilter } from "./calendar-filters";
import type { Block, TimeEntry, Week, CalendarItem } from "@168hours/contracts";

export type CalendarRecord =
  { kind: "block"; item: Block } | { kind: "entry"; item: TimeEntry };
export type TimeEditor = {
  kind: "block" | "entry";
  date: string;
  minute?: number;
  repeat?: boolean;
  allDay?: boolean;
  durationMinutes?: number;
  scheduledItem?: CalendarItem;
  fromItem?: CalendarItem;
  item?: Block | TimeEntry;
  allDayItem?: CalendarItem;
  linkedBlock?: Block;
  duplicateOf?: Block;
};
export type CalendarDraft = { title: string; startsAt: string; endsAt: string };
export type CalendarSaveResult =
  | { kind: "timed"; startsAt: string; count?: number }
  | { kind: "all_day"; date: string };
export type CalendarView = "month" | "week" | "day";
export const HOUR_HEIGHT = 60;
export const MIN_HOUR_HEIGHT = 12;
export const MAX_HOUR_HEIGHT = 240;
export type TimeTickMinutes = 15 | 30 | 60 | 120 | 240;
export const WEEK_VISIBLE_LANES = 2;

/** Keep the same scroll percentage while compressing, so the grid reaches its
 * full-day fit smoothly instead of abruptly hitting a scroll boundary. */
export function timeScaleScrollTop(
  anchor: { top: number; y: number; height: number },
  nextHeight: number,
  minimumHeight: number,
) {
  if (nextHeight < anchor.height && anchor.height > minimumHeight)
    return Math.max(
      0,
      (anchor.top * (nextHeight - minimumHeight)) /
        (anchor.height - minimumHeight),
    );
  return ((anchor.top + anchor.y) * nextHeight) / anchor.height - anchor.y;
}

export function timeTickMinutes(
  previous: TimeTickMinutes,
  hourHeight: number,
): TimeTickMinutes {
  if (previous === 240 && hourHeight < 26) return 240;
  if (hourHeight <= 20) return 240;
  if (previous === 15 && hourHeight > 140) return 15;
  if (hourHeight >= 150) return 15;
  if (previous === 30 && hourHeight > 84) return 30;
  if (previous === 120 && hourHeight < 42) return 120;
  if (hourHeight >= 90) return 30;
  if (hourHeight <= 36) return 120;
  return 60;
}

export function calendarHref(date: string, view: CalendarView = "week") {
  const query = new URLSearchParams({ date });
  query.set("view", view);
  return "/?" + query.toString();
}

export function dayRecords(
  week: Week,
  date: string,
  filter?: CalendarFilter,
): CalendarRecord[] {
  const day = week.days.find((day) => day.date === date);
  if (!day) return [];
  const records: CalendarRecord[] = [
    ...week.blocks
      .filter((item) => day.blockIds.includes(item.id))
      .map((item) => ({ kind: "block" as const, item })),
    ...week.entries
      .filter((item) => day.entryIds.includes(item.id))
      .map((item) => ({ kind: "entry" as const, item })),
  ];
  return records
    .filter((record) => matchesCalendar(record, filter))
    .sort(
      (a, b) =>
        a.item.startsAt.localeCompare(b.item.startsAt) ||
        a.item.id.localeCompare(b.item.id),
    );
}

/** Presentation only: clip normal 24-hour days and give colliding touch targets separate lanes.
 * Clock-change days use an ordered list, so repeated/missing hours never acquire false positions.
 */
export function layoutDay(
  records: CalendarRecord[],
  day: Week["days"][number],
) {
  const start = Date.parse(day.startsAt);
  const end = Date.parse(day.endsAt);
  const segments = records
    .map((record) => {
      const from = Math.max(start, Date.parse(record.item.startsAt));
      const to = Math.min(end, Date.parse(record.item.endsAt));
      const top = Math.min((from - start) / 60000, 1440);
      return {
        record,
        top,
        bottom: Math.min(1440, (to - start) / 60000),
        lane: 0,
        lanes: 1,
        valid: to > from,
      };
    })
    .filter((s) => s.valid)
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  let group: typeof segments = [];
  let ends: number[] = [];
  let until = -1;
  function finish() {
    for (const segment of group) segment.lanes = ends.length;
    group = [];
    ends = [];
  }
  for (const segment of segments) {
    if (segment.top >= until) finish();
    let lane = ends.findIndex((end) => end <= segment.top);
    if (lane === -1) lane = ends.length;
    segment.lane = lane;
    ends[lane] = segment.bottom;
    until = Math.max(until, segment.bottom);
    group.push(segment);
  }
  finish();
  return segments;
}

/** Snap a pointer within an hour to its containing five-minute interval. */
export function slotMinute(hour: number, offset: number, height: number) {
  return (
    hour * 60 +
    Math.max(0, Math.min(11, Math.floor((offset / height) * 12))) * 5
  );
}

/** Only overflow lanes are hidden; the rest of a busy day stays on the grid. */
export function visibleWeekSegments(segments: ReturnType<typeof layoutDay>) {
  return {
    visible: segments
      .filter((segment) => segment.lane < WEEK_VISIBLE_LANES)
      .map((segment) => ({
        ...segment,
        lanes: Math.min(segment.lanes, WEEK_VISIBLE_LANES),
      })),
    hidden: segments.filter((segment) => segment.lane >= WEEK_VISIBLE_LANES)
      .length,
  };
}
