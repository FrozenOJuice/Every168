import { useState } from "react";
import type { Block, CalendarItem } from "@168hours/contracts";
import { instantToLocalInput } from "@168hours/domain-utils";
import {
  daySelectionMode,
  noSelection,
  planKey,
  reduceSelection,
  selectionMode,
  type CalendarTimeSelection,
  type PlanSelection,
  type SelectionAction,
  type SelectionModifiers,
} from "./calendar-selection";

export function useCalendarSelection(
  scope: string,
  blocks: Block[],
  items: CalendarItem[],
  timezone: string,
) {
  const order = [
    ...blocks.map((block) => ({
      kind: "block" as const,
      id: block.id,
      order: instantToLocalInput(block.startsAt, timezone),
    })),
    ...items
      .filter((item) => item.kind === "all_day" && item.date)
      .map((item) => ({
        kind: "item" as const,
        id: item.id,
        order: `${item.date}T00:00`,
      })),
  ].sort(
    (a, b) =>
      a.order.localeCompare(b.order) || planKey(a).localeCompare(planKey(b)),
  );
  const [state, setState] = useState({ scope, selection: noSelection });
  const [multiSelect, setMultiSelect] = useState(false);
  const selection =
    state.scope === scope
      ? reduceSelection(state.selection, { type: "available", plans: order })
      : noSelection;
  if (state.scope !== scope || state.selection !== selection)
    setState({ scope, selection });
  function send(action: SelectionAction) {
    // Ignore late callbacks from a date/view that is no longer active.
    setState((current) => {
      if (current.scope !== scope) return current;
      const next = reduceSelection(current.selection, action);
      return next === current.selection
        ? current
        : { ...current, selection: next };
    });
  }
  function selectPlan(
    plan: PlanSelection,
    modifiers?: SelectionModifiers,
    replace = false,
  ) {
    send({
      type: "plan",
      plan,
      mode: replace ? "replace" : selectionMode(modifiers, multiSelect),
      order,
    });
  }
  const selectedPlans = selection.kind === "plans" ? selection.plans : [];
  const selectedDays = selection.kind === "days" ? selection.dates : [];
  const timeSelection: CalendarTimeSelection | null =
    selection.kind === "time"
      ? { date: selection.date, minute: selection.minute }
      : selection.kind === "days"
        ? { date: selection.date }
        : null;
  return {
    selection,
    selectedPlans,
    selectedDays,
    timeSelection,
    multiSelect,
    setMultiSelect,
    selectPlan,
    contextPlan: (plan: PlanSelection) => send({ type: "context-plan", plan }),
    contextDay: (date: string) => send({ type: "context-day", date }),
    preparePlans: () => send({ type: "prepare-plans" }),
    clear: () => send({ type: "clear" }),
    clearPlans: () => send({ type: "clear", kind: "plans" }),
    clearTime: () => send({ type: "clear", kind: "time" }),
    selectDay: (
      date: string,
      mode: "replace" | "toggle" | "extend" = "replace",
    ) => send({ type: "day", date, mode }),
    selectDayRange: (first: string, last: string) =>
      send({ type: "days", first, last }),
    selectTime: (point: CalendarTimeSelection) =>
      point.minute === undefined
        ? send({ type: "day", date: point.date, mode: "replace" })
        : send({ type: "time", date: point.date, minute: point.minute }),
    selectForDrag: (plan: PlanSelection, preserveGroup: boolean) =>
      send({ type: "drag", plan, preserveGroup }),
    dayMode: (modifiers?: SelectionModifiers) =>
      daySelectionMode(modifiers, multiSelect),
  };
}
export type CalendarSelectionController = ReturnType<
  typeof useCalendarSelection
>;
