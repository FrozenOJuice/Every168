import type { Block, CalendarItem } from "@168hours/contracts";
import { instantToLocalInput, localDate } from "@168hours/domain-utils";
import {
  planKey,
  type CalendarSelection,
  type PlanSelection,
} from "./calendar-selection";
import type { CalendarView } from "./calendar-layout";

export type CalendarActionTarget =
  | {
      kind: "plans";
      plans: PlanSelection[];
      date: string;
      pasteDate: string;
      pasteMinute?: number;
    }
  | { kind: "day"; date: string; days: string[] }
  | { kind: "time"; date: string; minute: number }
  | { kind: "all-day"; date: string }
  | { kind: "axis" };
export type PlanTargetData = {
  blocks: Pick<Block, "id" | "startsAt">[];
  items: Pick<CalendarItem, "id" | "kind" | "date">[];
  timezone: string;
};
export function planDestination(plan: PlanSelection, data: PlanTargetData) {
  if (plan.kind === "block") {
    const block = data.blocks.find((block) => block.id === plan.id);
    if (!block) return null;
    const time = instantToLocalInput(block.startsAt, data.timezone).slice(11);
    return {
      date: localDate(block.startsAt, data.timezone),
      minute: Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)),
    };
  }
  const item = data.items.find(
    (item) => item.id === plan.id && item.kind === "all_day",
  );
  return item?.date ? { date: item.date, minute: undefined } : null;
}
export function planActionTarget(
  plan: PlanSelection,
  selection: CalendarSelection,
  data: PlanTargetData,
  destination?: { date: string; minute?: number },
): CalendarActionTarget | null {
  const source = planDestination(plan, data);
  if (!source) return null;
  const selected =
    selection.kind === "plans" &&
    selection.plans.some((candidate) => planKey(candidate) === planKey(plan));
  return {
    kind: "plans",
    plans: selected ? selection.plans : [plan],
    date: source.date,
    pasteDate: destination?.date ?? source.date,
    pasteMinute: destination?.minute,
  };
}
export function dayActionTarget(
  date: string,
  selection: CalendarSelection,
): CalendarActionTarget {
  return {
    kind: "day",
    date,
    days:
      selection.kind === "days" && selection.dates.includes(date)
        ? selection.dates
        : [date],
  };
}
/** Toolbar actions use logical selection, independent of rendered/overflowed records. */
export function selectionActionTarget(
  selection: CalendarSelection,
  date: string,
  view: CalendarView,
  data: PlanTargetData,
): CalendarActionTarget | null {
  if (selection.kind === "plans") {
    const first = selection.plans[0];
    if (!first) return null;
    const source = planDestination(first, data);
    if (!source) return null;
    return planActionTarget(first, selection, data, {
      date: source.date,
      minute: view === "month" ? undefined : source.minute,
    });
  }
  if (selection.kind === "time")
    return { kind: "time", date: selection.date, minute: selection.minute };
  if (selection.kind === "days")
    return dayActionTarget([...selection.dates].sort()[0]!, selection);
  return dayActionTarget(date, selection);
}
