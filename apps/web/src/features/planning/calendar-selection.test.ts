import { expect, it } from "vitest";
import {
  daySelectionMode,
  noSelection,
  planKey,
  reduceSelection,
  selectionMode,
  type CalendarSelection,
  type PlanSelection,
  type SelectionMode,
} from "./calendar-selection";
import {
  dayActionTarget,
  planActionTarget,
  selectionActionTarget,
} from "./calendar-action-target";
const a: PlanSelection = { kind: "item", id: "a" },
  b: PlanSelection = { kind: "block", id: "b" },
  c: PlanSelection = { kind: "block", id: "c" };
const order = [a, b, c];
const select = (
  state: CalendarSelection,
  plan: PlanSelection,
  mode: SelectionMode = "replace",
) => reduceSelection(state, { type: "plan", plan, mode, order });
const day = (
  state: CalendarSelection,
  date: string,
  mode: "replace" | "toggle" | "extend" = "replace",
) => reduceSelection(state, { type: "day", date, mode });
it("plans, days and precise times are mutually exclusive", () => {
  const plans = select(noSelection, a);
  const days = day(plans, "2026-09-07");
  expect(days.kind).toBe("days");
  const time = reduceSelection(days, {
    type: "time",
    date: "2026-09-08",
    minute: 605,
  });
  expect(time).toEqual({ kind: "time", date: "2026-09-08", minute: 605 });
  expect(select(time, b)).toEqual({
    kind: "plans",
    plans: [b],
    anchor: planKey(b),
  });
});
it("mixed plan ranges keep their anchor while additive toggles move it", () => {
  const range = select(select(noSelection, a), c, "extend");
  expect(range).toEqual({ kind: "plans", plans: order, anchor: planKey(a) });
  expect(select(range, b, "toggle")).toEqual({
    kind: "plans",
    plans: [a, c],
    anchor: planKey(b),
  });
  expect(select(select(noSelection, c), a, "extend-add")).toEqual({
    kind: "plans",
    plans: [c, a, b],
    anchor: planKey(c),
  });
});
it("empty toggles reset anchors and selection kinds cannot extend each other", () => {
  expect(select(select(noSelection, b), b, "toggle")).toEqual(noSelection);
  expect(select(day(noSelection, "2026-09-07"), c, "extend")).toEqual({
    kind: "plans",
    plans: [c],
    anchor: planKey(c),
  });
});
it("day toggles retain their original anchor, including removal of that date", () => {
  let state = day(noSelection, "2026-09-07");
  state = day(state, "2026-09-10", "toggle");
  state = day(state, "2026-09-07", "toggle");
  expect(day(state, "2026-09-09", "extend")).toEqual({
    kind: "days",
    dates: ["2026-09-07", "2026-09-08", "2026-09-09"],
    anchor: "2026-09-07",
    date: "2026-09-09",
  });
});
it("reverse day dragging keeps its starting anchor and an ascending date range", () => {
  expect(
    reduceSelection(noSelection, {
      type: "days",
      first: "2026-09-09",
      last: "2026-09-07",
    }),
  ).toEqual({
    kind: "days",
    dates: ["2026-09-07", "2026-09-08", "2026-09-09"],
    anchor: "2026-09-09",
    date: "2026-09-07",
  });
});
it("context invocation preserves selected groups and replaces unselected targets", () => {
  const group = select(select(noSelection, a), b, "toggle");
  expect(reduceSelection(group, { type: "context-plan", plan: a })).toBe(group);
  expect(reduceSelection(group, { type: "context-plan", plan: c })).toEqual(
    select(noSelection, c),
  );
  const days = day(day(noSelection, "2026-09-07"), "2026-09-09", "toggle");
  expect(
    reduceSelection(days, { type: "context-day", date: "2026-09-09" }),
  ).toBe(days);
  expect(
    reduceSelection(days, { type: "context-day", date: "2026-09-10" }),
  ).toEqual(day(noSelection, "2026-09-10"));
});
it("drag selection retains selected groups but replaces unselected plans", () => {
  const group = select(select(noSelection, a), b, "toggle");
  expect(
    reduceSelection(group, { type: "drag", plan: a, preserveGroup: true }),
  ).toEqual({ kind: "plans", plans: [a, b], anchor: planKey(a) });
  expect(
    reduceSelection(group, { type: "drag", plan: c, preserveGroup: false }),
  ).toEqual(select(noSelection, c));
});
it("pointer and keyboard modifiers share rules while day Shift always extends", () => {
  const modifiers = { metaKey: true, ctrlKey: false, shiftKey: true };
  expect(selectionMode(modifiers)).toBe("extend-add");
  expect(daySelectionMode(modifiers)).toBe("extend");
  expect(selectionMode(undefined, true)).toBe("toggle");
});
const data = {
  timezone: "America/Edmonton",
  blocks: [
    { id: "b", startsAt: "2026-09-07T15:05:00Z" },
    { id: "c", startsAt: "2026-09-08T17:00:00Z" },
  ],
  items: [{ id: "a", kind: "all_day" as const, date: "2026-09-06" }],
};
it("selection action targets use account-local plan metadata without DOM elements", () => {
  const selection = select(noSelection, b);
  expect(selectionActionTarget(selection, "2026-09-10", "week", data)).toEqual({
    kind: "plans",
    plans: [b],
    date: "2026-09-07",
    pasteDate: "2026-09-07",
    pasteMinute: 545,
  });
  expect(
    selectionActionTarget(selection, "2026-09-10", "month", data),
  ).toMatchObject({ pasteDate: "2026-09-07", pasteMinute: undefined });
});
it("context targets keep the invoked destination and selected group", () => {
  const group = select(select(noSelection, b), a, "toggle");
  expect(planActionTarget(a, group, data, { date: "2026-09-08" })).toEqual({
    kind: "plans",
    plans: [b, a],
    date: "2026-09-06",
    pasteDate: "2026-09-08",
    pasteMinute: undefined,
  });
  expect(
    planActionTarget(c, group, data, { date: "2026-09-10", minute: 600 }),
  ).toMatchObject({ plans: [c], pasteDate: "2026-09-10", pasteMinute: 600 });
});
it("day toolbar actions use earliest selected date while context menus use invoked date", () => {
  const days = day(day(noSelection, "2026-09-09"), "2026-09-07", "toggle");
  expect(
    selectionActionTarget(days, "2026-09-10", "month", data),
  ).toMatchObject({ date: "2026-09-07", days: ["2026-09-07", "2026-09-09"] });
  expect(dayActionTarget("2026-09-09", days)).toMatchObject({
    date: "2026-09-09",
    days: ["2026-09-07", "2026-09-09"],
  });
  expect(selectionActionTarget(noSelection, "2026-09-10", "day", data)).toEqual(
    { kind: "day", date: "2026-09-10", days: ["2026-09-10"] },
  );
});
it("precise time targets stay precise; missing plan records do not produce a misleading menu", () => {
  expect(
    selectionActionTarget(
      { kind: "time", date: "2026-09-07", minute: 545 },
      "2026-09-10",
      "week",
      data,
    ),
  ).toEqual({ kind: "time", date: "2026-09-07", minute: 545 });
  expect(
    selectionActionTarget(
      select(noSelection, { kind: "block", id: "missing" }),
      "2026-09-10",
      "week",
      data,
    ),
  ).toBeNull();
});
it("data refresh removes unavailable plans and anchors while retaining valid group members", () => {
  const group = select(select(noSelection, a), b, "toggle");
  expect(reduceSelection(group, { type: "available", plans: [a] })).toEqual({
    kind: "plans",
    plans: [a],
    anchor: null,
  });
  expect(reduceSelection(group, { type: "available", plans: [] })).toEqual(
    noSelection,
  );
  expect(reduceSelection(group, { type: "available", plans: order })).toBe(
    group,
  );
});
it("a plan returned by multiple loaded weeks is selected once in a chronological range", () => {
  expect(
    reduceSelection(select(noSelection, a), {
      type: "plan",
      plan: c,
      mode: "extend",
      order: [a, b, b, c],
    }),
  ).toEqual({ kind: "plans", plans: order, anchor: planKey(a) });
});
