import { expect, it } from "vitest";
import { blockSchema, calendarItemSchema } from "@168hours/contracts";
import { dragDates, movePlans } from "./calendar-plan-motion";
const base = {
  id: "00000000-0000-4000-8000-000000000001",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  title: "Plan",
  categoryId: null,
  goalId: null,
  notes: null,
  seriesId: null,
  occurrenceDate: null,
  isException: false,
};
const item = calendarItemSchema.parse({
  ...base,
  kind: "all_day",
  date: "2026-03-07",
  endDate: "2026-03-09",
});
it("all-day moves retain the inclusive span and resize only the chosen endpoint", () => {
  const origin = { date: "2026-03-08" },
    target = { date: "2026-03-10" };
  expect(dragDates(item, "move", origin, target)).toEqual({
    date: "2026-03-09",
    endDate: "2026-03-11",
  });
  expect(dragDates(item, "start", origin, target)).toEqual({
    date: "2026-03-09",
    endDate: "2026-03-09",
  });
  expect(dragDates(item, "end", origin, target)).toEqual({
    date: "2026-03-07",
    endDate: "2026-03-11",
  });
  expect(dragDates(item, "start", origin, { date: "2026-03-11" })).toBeNull();
  expect(dragDates(item, "end", origin, { date: "2026-04-07" })).toBeNull();
});
it("group movement preserves local spacing, exact durations and date-only types across DST", () => {
  const block = blockSchema.parse({
    ...base,
    startsAt: "2026-03-07T16:00:30.125Z",
    endsAt: "2026-03-07T17:30:30.125Z",
  });
  const moved = movePlans(
    [
      block,
      {
        ...block,
        id: "second",
        startsAt: "2026-03-08T19:00:30.125Z",
        endsAt: "2026-03-08T20:30:30.125Z",
      },
    ],
    [item],
    1,
    30,
    "America/Edmonton",
  )!;
  expect(moved.blocks.map((b) => b.startsAt)).toEqual([
    "2026-03-08T15:30:30.125Z",
    "2026-03-09T19:30:30.125Z",
  ]);
  expect(
    moved.blocks.every(
      (b) => Date.parse(b.endsAt) - Date.parse(b.startsAt) === 90 * 60000,
    ),
  ).toBe(true);
  expect(moved.items[0]).toMatchObject({
    kind: "all_day",
    date: "2026-03-08",
    endDate: "2026-03-10",
  });
  expect(
    movePlans(
      [{ ...block, startsAt: "2026-03-07T09:30:00Z" }],
      [],
      1,
      0,
      "America/Edmonton",
    ),
  ).toBeNull();
});
