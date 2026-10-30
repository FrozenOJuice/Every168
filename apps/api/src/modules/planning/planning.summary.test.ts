import { expect, it } from "vitest";
import { summarizeWeek } from "./planning.summary.js";
it("excludes paused workout time from recorded/category totals without duplicating its source", () => {
  const result = summarizeWeek(
    [],
    [
      {
        id: "session",
        categoryId: null,
        startsAt: "2026-10-28T23:00:00Z",
        endsAt: "2026-10-29T02:00:00Z",
        excludedIntervals: [
          { startsAt: "2026-10-28T23:30:00Z", endsAt: "2026-10-29T01:00:00Z" },
        ],
      },
    ],
    [],
    { startsAt: "2026-10-29T00:00:00Z", endsAt: "2026-10-30T00:00:00Z" },
  );
  expect(result.recordedSeconds).toBe(3600);
  expect(result.categories[0]?.recordedSeconds).toBe(3600);
});
