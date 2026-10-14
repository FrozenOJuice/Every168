import type { Block, CalendarItem } from "@168hours/contracts";
import {
  addDays,
  daysBetween,
  localDate,
  localMinute,
  shiftPlannedTime,
} from "@168hours/domain-utils";
import { formatTime } from "../../lib/format";
import type { CalendarPoint, DragMode } from "./calendar-drag";

export function dragDates(
  item: CalendarItem,
  mode: Exclude<DragMode, "create">,
  origin: CalendarPoint,
  target: CalendarPoint,
) {
  const delta = daysBetween(origin.date, target.date);
  const date = mode === "end" ? item.date! : addDays(item.date!, delta);
  const endDate =
    mode === "start" ? item.endDate! : addDays(item.endDate!, delta);
  return endDate >= date && daysBetween(date, endDate) < 31
    ? { date, endDate }
    : null;
}
export function motionDelta(
  block: Block,
  times: { startsAt: string },
  timezone: string,
) {
  return {
    dayDelta: daysBetween(
      localDate(block.startsAt, timezone),
      localDate(times.startsAt, timezone),
    ),
    minuteDelta:
      Math.round(
        (localMinute(times.startsAt, timezone) -
          localMinute(block.startsAt, timezone)) /
          5,
      ) * 5,
  };
}
export function movePlans(
  blocks: Block[],
  items: CalendarItem[],
  dayDelta: number,
  minuteDelta: number,
  timezone: string,
) {
  const moved = blocks.map((block) => {
    const times = shiftPlannedTime(
      block.startsAt,
      block.endsAt,
      dayDelta,
      minuteDelta,
      timezone,
    );
    return times ? { ...block, ...times } : null;
  });
  if (moved.some((b) => !b)) return null;
  return {
    blocks: moved as Block[],
    items: items.map((item) => ({
      ...item,
      date: addDays(item.date!, dayDelta),
      endDate: addDays(item.endDate!, dayDelta),
    })),
  };
}
export type MovingPlan = {
  key: string;
  title: string;
  label: string;
  bounds: { left: number; top: number; width: number; height: number };
};
export function motionPreviews(
  plans: { blocks: Block[]; items: CalendarItem[] },
  timezone: string,
  hourHeight: number,
): MovingPlan[] {
  const previews: MovingPlan[] = [];
  for (const block of plans.blocks) {
    const days = document.querySelectorAll<HTMLElement>(
      "[data-drag-day], [data-drop-date]",
    );
    for (const day of days) {
      const date = day.dataset.dragDay ?? day.dataset.dropDate!;
      const startDate = localDate(block.startsAt, timezone),
        endDate = localDate(new Date(Date.parse(block.endsAt) - 1), timezone);
      if (date < startDate || date > endDate) continue;
      const rect = day.getBoundingClientRect();
      const grid = !!day.dataset.dragDay;
      const start =
        date === startDate ? localMinute(block.startsAt, timezone) : 0;
      const end =
        date === localDate(block.endsAt, timezone)
          ? localMinute(block.endsAt, timezone)
          : 1440;
      const heading = day
        .querySelector(".month-day-heading")
        ?.getBoundingClientRect();
      previews.push({
        key: block.id + date,
        title: block.title,
        label: `${formatTime(block.startsAt, timezone)} - ${formatTime(block.endsAt, timezone)}\n${date}`,
        bounds: {
          left: rect.left + (grid ? 2 : 4),
          top: grid
            ? rect.top + (start / 60) * hourHeight
            : (heading?.bottom ?? rect.top) + 4,
          width:
            rect.width -
            (grid ? 4 + (day.classList.contains("has-moments") ? 44 : 0) : 8),
          height: grid ? Math.max(1, ((end - start) / 60) * hourHeight) : 26,
        },
      });
    }
  }
  for (const item of plans.items) {
    for (const day of document.querySelectorAll<HTMLElement>(
      "[data-context-all-day], [data-drop-date]",
    )) {
      const date = day.dataset.contextAllDay ?? day.dataset.dropDate!;
      if (date < item.date! || date > item.endDate!) continue;
      const rect = day.getBoundingClientRect();
      const heading = day
        .querySelector(".month-day-heading")
        ?.getBoundingClientRect();
      previews.push({
        key: item.id + date,
        title: item.title,
        label:
          item.date === item.endDate
            ? `All day\n${item.date}`
            : `All day\n${item.date} - ${item.endDate}`,
        bounds: {
          left: rect.left + 3,
          top: (heading?.bottom ?? rect.top) + 3,
          width: rect.width - 6,
          height: 26,
        },
      });
    }
  }
  return previews;
}
