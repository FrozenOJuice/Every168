import { describe, expect, it } from "vitest";
import { historyHref, parseHistoryReturn } from "./workout-history-return";
describe("workout History navigation", () => {
  it("retains search and week while dropping unrelated parameters", () => {
    expect(historyHref("  Leg day  ", "2026-10-28")).toBe(
      "/fitness/history?search=Leg+day&date=2026-10-28",
    );
    expect(
      parseHistoryReturn(
        "/fitness/history?search=Leg+day&status=all&date=2026-10-28&restoreSession=ignored",
      ),
    ).toBe("/fitness/history?search=Leg+day&date=2026-10-28");
    expect(
      parseHistoryReturn("/fitness/history?status=invalid&date=2026-02-30"),
    ).toBe("/fitness/history");
  });
  it("rejects destinations outside History", () => {
    for (const path of [
      "https://example.com/fitness/history",
      "//example.com/fitness/history",
      "/fitness/history/extra",
      "/fitness/exercises",
      "https://[",
      undefined,
    ])
      expect(parseHistoryReturn(path)).toBeUndefined();
  });
});
