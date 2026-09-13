import { matchesCalendar, type CalendarFilter } from "./calendar-filters";
import type { Block, TimeEntry, Week, CalendarItem } from "@168hours/contracts";

export type CalendarRecord =
  { kind: "block"; item: Block } | { kind: "entry"; item: TimeEntry };
export type TimeEditor = {
  kind: "block" | "entry";
  date: string;
  minute?: number;
  durationMinutes?: number;
  scheduledItem?: CalendarItem;
  item?: Block | TimeEntry;
  linkedBlock?: Block;
  duplicateOf?: Block;
};
export type CalendarView = "month" | "week" | "day";
export const HOUR_HEIGHT = 72;
export const WEEK_VISIBLE_LANES = 2;
const MIN_MINUTES = (46 / HOUR_HEIGHT) * 60;

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
      const top = Math.min((from - start) / 60000, 1440 - MIN_MINUTES);
      return {
        record,
        top,
        bottom: Math.min(
          1440,
          Math.max((to - start) / 60000, top + MIN_MINUTES),
        ),
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

/** Snap a pointer within an hour to its containing quarter hour. */
export function slotMinute(hour: number, offset: number, height: number) {
  return (
    hour * 60 + Math.max(0, Math.min(3, Math.floor((offset / height) * 4))) * 15
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
