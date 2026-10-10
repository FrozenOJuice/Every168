import type { Block, BlockInput } from "@168hours/contracts";
import {
  addDays,
  daysBetween,
  localDate,
  localMinute,
  plannedInstant,
} from "@168hours/domain-utils";
export type DragMode = "move" | "start" | "end" | "create";
export type CalendarPoint = { date: string; minute?: number };
export function dragTimes(
  block: Block,
  mode: Exclude<DragMode, "create">,
  origin: CalendarPoint,
  target: CalendarPoint,
  timezone: string,
): Pick<BlockInput, "startsAt" | "endsAt"> | null {
  const start = Date.parse(block.startsAt),
    end = Date.parse(block.endsAt);
  if (target.minute === undefined) {
    if (mode !== "move") return null;
    const date = addDays(
      localDate(block.startsAt, timezone),
      daysBetween(origin.date, target.date),
    );
    const next = plannedInstant(
      date,
      localMinute(block.startsAt, timezone),
      timezone,
    );
    return next
      ? {
          startsAt: next,
          endsAt: new Date(Date.parse(next) + end - start).toISOString(),
        }
      : null;
  }
  const instant = plannedInstant(target.date, target.minute, timezone);
  if (!instant) return null;
  const at = Date.parse(instant);
  const grabbed =
    origin.minute === undefined
      ? start
      : Date.parse(plannedInstant(origin.date, origin.minute, timezone)!);
  const delta = at - grabbed;
  if (mode === "start")
    return start + delta < end && end - start - delta <= 31 * 86400000
      ? {
          startsAt: new Date(start + delta).toISOString(),
          endsAt: block.endsAt,
        }
      : null;
  if (mode === "end")
    return end + delta > start && end + delta - start <= 31 * 86400000
      ? {
          startsAt: block.startsAt,
          endsAt: new Date(end + delta).toISOString(),
        }
      : null;
  const offset = Math.round((grabbed - start) / 300000) * 300000;
  return {
    startsAt: new Date(at - offset).toISOString(),
    endsAt: new Date(at - offset + end - start).toISOString(),
  };
}
export function dragSelection(
  origin: CalendarPoint,
  target: CalendarPoint,
  timezone: string,
) {
  if (origin.minute === undefined || target.minute === undefined) return null;
  const a = plannedInstant(origin.date, origin.minute, timezone),
    b = plannedInstant(target.date, target.minute, timezone);
  if (!a || !b) return null;
  let start = Math.min(Date.parse(a), Date.parse(b)),
    end = Math.max(Date.parse(a), Date.parse(b));
  if (start === end) {
    if (origin.minute === 1440) start -= 300000;
    else end += 300000;
  }
  if (end - start > 31 * 86400000) return null;
  return {
    date: localDate(new Date(start), timezone),
    minute: localMinute(new Date(start), timezone),
    durationMinutes: (end - start) / 60000,
  };
}
