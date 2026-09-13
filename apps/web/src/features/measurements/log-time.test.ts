import { expect, it } from "vitest";
import { instantForLogDate } from "./log-time";

it("keeps today's actual instant even when UTC has crossed midnight or the clock repeats", () => {
  expect(
    instantForLogDate(
      "2026-09-12",
      "America/Edmonton",
      new Date("2026-09-13T03:30:00Z"),
    ),
  ).toBe("2026-09-13T03:30:00.000Z");
  expect(
    instantForLogDate(
      "2026-11-01",
      "America/Edmonton",
      new Date("2026-11-01T08:30:00Z"),
    ),
  ).toBe("2026-11-01T08:30:00.000Z");
});
it("places backdated quick logs at noon in the account timezone", () => {
  expect(
    instantForLogDate(
      "2026-03-08",
      "America/Edmonton",
      new Date("2026-09-12T12:00:00Z"),
    ),
  ).toBe("2026-03-08T18:00:00Z");
});
