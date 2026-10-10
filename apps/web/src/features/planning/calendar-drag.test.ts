import { expect, it } from "vitest";
import { blockSchema } from "@168hours/contracts";
import { dragSelection, dragTimes } from "./calendar-drag";
const block = blockSchema.parse({
  id: "00000000-0000-4000-8000-000000000001",
  version: 1,
  createdAt: "2026-09-07T00:00:00Z",
  updatedAt: "2026-09-07T00:00:00Z",
  title: "Plan",
  categoryId: null,
  goalId: null,
  notes: null,
  seriesId: null,
  occurrenceDate: null,
  isException: false,
  startsAt: "2026-09-07T15:00:00Z",
  endsAt: "2026-09-07T16:00:00Z",
});
it("snaps grid moves while keeping the grab offset and elapsed duration", () => {
  expect(
    dragTimes(
      block,
      "move",
      { date: "2026-09-07", minute: 570 },
      { date: "2026-09-08", minute: 660 },
      "America/Edmonton",
    ),
  ).toEqual({
    startsAt: "2026-09-08T16:30:00.000Z",
    endsAt: "2026-09-08T17:30:00.000Z",
  });
});
it("moves and resizes by five minutes without rounding a five-minute grab offset to quarters", () => {
  const origin = { date: "2026-09-07", minute: 560 };
  const target = { date: origin.date, minute: 565 };
  expect(dragTimes(block, "move", origin, target, "America/Edmonton")).toEqual({
    startsAt: "2026-09-07T15:05:00.000Z",
    endsAt: "2026-09-07T16:05:00.000Z",
  });
  expect(dragTimes(block, "start", origin, target, "America/Edmonton")).toEqual(
    {
      startsAt: "2026-09-07T15:05:00.000Z",
      endsAt: block.endsAt,
    },
  );
  expect(dragTimes(block, "end", origin, target, "America/Edmonton")).toEqual({
    startsAt: block.startsAt,
    endsAt: "2026-09-07T16:05:00.000Z",
  });
});
it("moves a continuation relative to the original start date, including across DST", () => {
  const overnight = {
    ...block,
    startsAt: "2026-10-31T05:30:00Z",
    endsAt: "2026-10-31T07:00:00Z",
  };
  expect(
    dragTimes(
      overnight,
      "move",
      { date: "2026-10-31" },
      { date: "2026-11-02" },
      "America/Edmonton",
    ),
  ).toEqual({
    startsAt: "2026-11-02T06:30:00Z",
    endsAt: "2026-11-02T08:00:00.000Z",
  });
});
it("rejects invalid resize bounds and missing local clock times", () => {
  expect(
    dragTimes(
      block,
      "end",
      { date: "2026-09-07", minute: 600 },
      { date: "2026-09-07", minute: 540 },
      "America/Edmonton",
    ),
  ).toBeNull();
  expect(
    dragTimes(
      block,
      "start",
      { date: "2026-09-07", minute: 540 },
      { date: "2026-09-07", minute: 615 },
      "America/Edmonton",
    ),
  ).toBeNull();
  expect(
    dragTimes(
      { ...block, startsAt: "2026-03-07T09:30:00Z" },
      "move",
      { date: "2026-03-07" },
      { date: "2026-03-08" },
      "America/Edmonton",
    ),
  ).toBeNull();
});
it("creates a reversible five-minute selection and keeps midnight within the day", () => {
  const a = { date: "2026-09-07", minute: 540 },
    b = { date: "2026-09-07", minute: 565 };
  expect(dragSelection(a, b, "America/Edmonton")).toEqual({
    date: a.date,
    minute: 540,
    durationMinutes: 25,
  });
  expect(dragSelection(b, a, "America/Edmonton")).toEqual(
    dragSelection(a, b, "America/Edmonton"),
  );
  expect(dragSelection(a, { date: a.date }, "America/Edmonton")).toBeNull();
  expect(
    dragSelection(
      { date: a.date, minute: 1440 },
      { date: a.date, minute: 1440 },
      "America/Edmonton",
    ),
  ).toEqual({ date: a.date, minute: 1435, durationMinutes: 5 });
  expect(dragSelection(a, a, "America/Edmonton")).toEqual({
    date: a.date,
    minute: 540,
    durationMinutes: 5,
  });
});
