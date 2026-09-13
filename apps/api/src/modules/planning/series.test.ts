import { expect, it } from "vitest";
import { seriesInput } from "@168hours/contracts";
import { expandSeries } from "./series.service.js";
const rule = seriesInput.parse({
  title: "Routine",
  timezone: "America/Edmonton",
  startDate: "2026-03-07",
  untilDate: "2026-03-09",
  startMinute: 150,
  durationMinutes: 60,
  frequency: "daily",
  interval: 1,
  weekdays: [1],
});
it("skips gaps, uses the first repeated time, and keeps elapsed durations", () => {
  const spring = expandSeries(rule);
  expect(spring.skippedDates).toEqual(["2026-03-08"]);
  expect(spring.occurrences.map((o) => o.startsAt)).toEqual([
    "2026-03-07T09:30:00Z",
    "2026-03-09T08:30:00Z",
  ]);
  const fall = expandSeries({
    ...rule,
    startDate: "2026-11-01",
    untilDate: "2026-11-01",
    startMinute: 90,
  });
  expect(fall.occurrences[0]).toEqual({
    date: "2026-11-01",
    startsAt: "2026-11-01T07:30:00Z",
    endsAt: "2026-11-01T08:30:00.000Z",
  });
});
it("anchors alternate weeks consistently, honors weekdays, and retains exclusions", () => {
  const result = expandSeries(
    {
      ...rule,
      startDate: "2026-09-09",
      untilDate: "2026-09-28",
      frequency: "weekly",
      interval: 2,
      weekdays: [1, 3, 5],
    },
    ["2026-09-23"],
  );
  expect(result.occurrences.map((o) => o.date)).toEqual([
    "2026-09-09",
    "2026-09-11",
    "2026-09-21",
    "2026-09-25",
  ]);
});
it("bounds recurrence and rejects duplicate weekdays", () => {
  expect(
    seriesInput.safeParse({ ...rule, untilDate: "2028-01-01" }).success,
  ).toBe(false);
  expect(seriesInput.safeParse({ ...rule, weekdays: [1, 1] }).success).toBe(
    false,
  );
});
