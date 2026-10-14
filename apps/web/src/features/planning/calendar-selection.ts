import { addDays, daysBetween } from "@168hours/domain-utils";

export type PlanSelection = { kind: "block" | "item"; id: string };
export type CalendarTimeSelection = { date: string; minute?: number };
export type SelectionMode = "replace" | "toggle" | "extend" | "extend-add";
export type SelectionModifiers = {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
};
export type CalendarSelection =
  | { kind: "none" }
  | { kind: "plans"; plans: PlanSelection[]; anchor: string | null }
  | { kind: "days"; dates: string[]; anchor: string; date: string }
  | { kind: "time"; date: string; minute: number };
export type SelectionAction =
  | { type: "available"; plans: PlanSelection[] }
  | { type: "context-plan"; plan: PlanSelection }
  | { type: "context-day"; date: string }
  | { type: "prepare-plans" }
  | { type: "clear"; kind?: "plans" | "time" }
  | {
      type: "plan";
      plan: PlanSelection;
      mode: SelectionMode;
      order: PlanSelection[];
    }
  | { type: "drag"; plan: PlanSelection; preserveGroup: boolean }
  | { type: "day"; date: string; mode: Exclude<SelectionMode, "extend-add"> }
  | { type: "days"; first: string; last: string }
  | { type: "time"; date: string; minute: number };
export const noSelection: CalendarSelection = { kind: "none" };
export const planKey = (plan: PlanSelection) => `${plan.kind}:${plan.id}`;
export function selectionMode(
  modifiers?: SelectionModifiers,
  multiple = false,
): SelectionMode {
  const toggle = multiple || modifiers?.metaKey || modifiers?.ctrlKey;
  return modifiers?.shiftKey
    ? toggle
      ? "extend-add"
      : "extend"
    : toggle
      ? "toggle"
      : "replace";
}
export function daySelectionMode(
  modifiers?: SelectionModifiers,
  multiple = false,
) {
  const mode = selectionMode(modifiers, multiple);
  return mode === "extend-add" ? "extend" : mode;
}
function datesBetween(first: string, last: string) {
  const start = first < last ? first : last;
  const end = first < last ? last : first;
  return Array.from({ length: daysBetween(start, end) + 1 }, (_, index) =>
    addDays(start, index),
  );
}
export function reduceSelection(
  state: CalendarSelection,
  action: SelectionAction,
): CalendarSelection {
  if (action.type === "available") {
    if (state.kind !== "plans") return state;
    const available = new Set(action.plans.map(planKey));
    const plans = state.plans.filter((plan) => available.has(planKey(plan)));
    if (!plans.length) return noSelection;
    if (
      plans.length === state.plans.length &&
      (!state.anchor || available.has(state.anchor))
    )
      return state;
    return {
      kind: "plans",
      plans,
      anchor: state.anchor && available.has(state.anchor) ? state.anchor : null,
    };
  }
  if (action.type === "context-plan")
    return state.kind === "plans" &&
      state.plans.some((plan) => planKey(plan) === planKey(action.plan))
      ? state
      : { kind: "plans", plans: [action.plan], anchor: planKey(action.plan) };
  if (action.type === "context-day")
    return state.kind === "days" && state.dates.includes(action.date)
      ? state
      : {
          kind: "days",
          dates: [action.date],
          anchor: action.date,
          date: action.date,
        };
  if (action.type === "prepare-plans")
    return state.kind === "plans" ? state : noSelection;
  if (action.type === "clear")
    return !action.kind || state.kind === action.kind ? noSelection : state;
  if (action.type === "time")
    return { kind: "time", date: action.date, minute: action.minute };
  if (action.type === "days")
    return {
      kind: "days",
      dates: datesBetween(action.first, action.last),
      anchor: action.first,
      date: action.first < action.last ? action.first : action.last,
    };
  if (action.type === "day") {
    const previous = state.kind === "days" ? state : null;
    if (action.mode === "extend" && previous)
      return {
        kind: "days",
        dates: datesBetween(previous.anchor, action.date),
        anchor: previous.anchor,
        date: action.date,
      };
    if (action.mode === "toggle" && previous) {
      const dates = previous.dates.includes(action.date)
        ? previous.dates.filter((date) => date !== action.date)
        : [...previous.dates, action.date].sort();
      if (!dates.length) return noSelection;
      return {
        kind: "days",
        dates,
        anchor: previous.anchor,
        date: dates.includes(action.date)
          ? action.date
          : dates.includes(previous.anchor)
            ? previous.anchor
            : dates[0]!,
      };
    }
    return {
      kind: "days",
      dates: [action.date],
      anchor: action.date,
      date: action.date,
    };
  }
  const key = planKey(action.plan);
  const previous = state.kind === "plans" ? state : null;
  const plans = previous?.plans ?? [];
  if (action.type === "drag")
    return {
      kind: "plans",
      plans:
        action.preserveGroup && plans.some((plan) => planKey(plan) === key)
          ? plans
          : [action.plan],
      anchor: key,
    };
  if (
    (action.mode === "extend" || action.mode === "extend-add") &&
    previous?.anchor
  ) {
    // A spanning plan can be returned by more than one loaded week.
    const order = [
      ...new Map(action.order.map((plan) => [planKey(plan), plan])).values(),
    ];
    const start = order.findIndex((plan) => planKey(plan) === previous.anchor);
    const end = order.findIndex((plan) => planKey(plan) === key);
    if (start >= 0 && end >= 0) {
      const range = order.slice(Math.min(start, end), Math.max(start, end) + 1);
      const existing = action.mode === "extend-add" ? plans : [];
      const keys = new Set(existing.map(planKey));
      return {
        kind: "plans",
        plans: [
          ...existing,
          ...range.filter((plan) => !keys.has(planKey(plan))),
        ],
        anchor: previous.anchor,
      };
    }
  }
  if (action.mode === "toggle") {
    const next = plans.some((plan) => planKey(plan) === key)
      ? plans.filter((plan) => planKey(plan) !== key)
      : [...plans, action.plan];
    return next.length
      ? { kind: "plans", plans: next, anchor: key }
      : noSelection;
  }
  return { kind: "plans", plans: [action.plan], anchor: key };
}
