import { describe, it, expect } from "vitest";
import { nextTaskDate, shiftTaskDate } from "./tasks.recurrence.js";
describe("task recurrence dates", () => {
  it("clamps monthly occurrences while retaining the original day", () => {
    const rule = { frequency: "monthly" as const, until: null };
    expect(nextTaskDate("2028-01-31", "2028-01-31", rule)).toBe("2028-02-29");
    expect(nextTaskDate("2028-02-29", "2028-01-31", rule)).toBe("2028-03-31");
    expect(nextTaskDate("2027-01-31", "2027-01-31", rule)).toBe("2027-02-28");
    expect(nextTaskDate("0099-12-31", "0099-12-31", rule)).toBe("0100-01-31");
  });
  it("uses local calendar dates for weekly/daily rules and inclusive end dates", () => {
    expect(
      nextTaskDate("2026-03-07", "2026-03-07", {
        frequency: "daily",
        until: null,
      }),
    ).toBe("2026-03-08");
    expect(
      nextTaskDate("2026-10-30", "2026-10-30", {
        frequency: "weekly",
        until: "2026-11-06",
      }),
    ).toBe("2026-11-06");
    expect(
      nextTaskDate("2026-11-06", "2026-10-30", {
        frequency: "weekly",
        until: "2026-11-06",
      }),
    ).toBeNull();
    expect(
      nextTaskDate("9999-12-31", "9999-12-31", {
        frequency: "daily",
        until: null,
      }),
    ).toBeNull();
  });
  it("preserves the distance between deadlines and planned work", () => {
    expect(shiftTaskDate("2026-03-10", "2026-03-07", "2026-03-08")).toBe(
      "2026-03-11",
    );
    expect(shiftTaskDate(null, "2026-03-07", "2026-03-08")).toBeNull();
  });
});
