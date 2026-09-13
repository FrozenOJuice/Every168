import { addDays, weekRange } from "@168hours/domain-utils";
import type { CalendarView } from "./calendar-layout";

export function shiftPeriod(
  date: string,
  view: CalendarView,
  direction: -1 | 1,
) {
  if (view !== "month")
    return addDays(date, direction * (view === "week" ? 7 : 1));
  const first = date.slice(0, 7) + "-01";
  const target = addDays(first, direction === 1 ? 32 : -1).slice(0, 7) + "-01";
  const next = addDays(target, 32).slice(0, 7) + "-01";
  const lastDay = Number(addDays(next, -1).slice(8));
  return addDays(target, Math.min(Number(date.slice(8)), lastDay) - 1);
}

/** Visible month rows follow the user's local week-start preference, including spillover days. */
export function monthWeekStarts(
  date: string,
  timezone: string,
  weekStartsOn: number,
) {
  const first = date.slice(0, 7) + "-01";
  const next = shiftPeriod(first, "month", 1);
  const start = weekRange(first, timezone, weekStartsOn).weekStart;
  const weeks: string[] = [];
  for (let day = start; day < next; day = addDays(day, 7)) weeks.push(day);
  return weeks;
}
