import { expect, it } from "vitest";
import { blockSchema } from "@168hours/contracts";
import { calendarBlocks } from "./calendar-records";
it("retains a single highest revision for overlapping week records", () => {
  const old = blockSchema.parse({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Cross week",
    startsAt: "2026-09-06T23:30:00Z",
    endsAt: "2026-09-07T00:30:00Z",
    categoryId: null,
    goalId: null,
    notes: null,
    seriesId: null,
    occurrenceDate: null,
    isException: false,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    version: 1,
  });
  const current = { ...old, title: "Current", version: 2 };
  expect(calendarBlocks([{ blocks: [current] }, { blocks: [old] }])).toEqual([
    current,
  ]);
});
