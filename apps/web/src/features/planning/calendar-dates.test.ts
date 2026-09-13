import { describe, expect, it } from "vitest";
import { monthWeekStarts, shiftPeriod } from "./calendar-dates";

describe("calendar periods", () => {
  it("clamps month navigation at month ends, including leap years and year boundaries", () => {
    expect(shiftPeriod("2026-01-31", "month", 1)).toBe("2026-02-28");
    expect(shiftPeriod("2028-03-31", "month", -1)).toBe("2028-02-29");
    expect(shiftPeriod("2026-12-31", "month", 1)).toBe("2027-01-31");
    expect(shiftPeriod("2026-01-01", "month", -1)).toBe("2025-12-01");
  });
  it("moves by local calendar dates across clock changes", () => {
    expect(shiftPeriod("2026-11-01", "day", 1)).toBe("2026-11-02");
    expect(shiftPeriod("2026-11-01", "week", -1)).toBe("2026-10-25");
  });
  it("includes every visible month row and respects Sunday or Monday starts", () => {
    expect(monthWeekStarts("2026-08-17", "America/Edmonton", 1)).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
    expect(monthWeekStarts("2026-02-01", "America/Edmonton", 0)).toEqual([
      "2026-02-01",
      "2026-02-08",
      "2026-02-15",
      "2026-02-22",
    ]);
  });
  it("covers spillover dates and leap days independently of the browser's timezone", () => {
    expect(monthWeekStarts("2028-02-29", "Pacific/Auckland", 1)).toEqual([
      "2028-01-31",
      "2028-02-07",
      "2028-02-14",
      "2028-02-21",
      "2028-02-28",
    ]);
    expect(monthWeekStarts("2026-11-01", "America/Edmonton", 0)).toHaveLength(
      5,
    );
  });
});
