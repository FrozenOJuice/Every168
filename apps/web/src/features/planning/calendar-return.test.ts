import { expect, it } from "vitest";
import { calendarWorkoutHref, parseCalendarReturn } from "./calendar-return";
it("accepts only explicit valid Calendar views, without actions or external redirects", () => {
  expect(parseCalendarReturn("/?view=month&date=2026-10-28")).toBe(
    "/?date=2026-10-28&view=month",
  );
  for (const value of [
    undefined,
    "/",
    "https://evil.invalid/?date=2026-10-28&view=day",
    "//evil.invalid/?date=2026-10-28&view=day",
    "/fitness?date=2026-10-28&view=day",
    "/?date=2026-02-30&view=day",
    "/?date=2026-10-28&view=other",
    "/?date=2026-10-28&view=day&add=1",
    "/?date=2026-10-28&view=day#fragment",
    "/?date=2026-10-28&view=day&view=week",
  ])
    expect(parseCalendarReturn(value)).toBeUndefined();
});
it("attaches Calendar context only to workout destinations and retains other query values", () => {
  const href =
    "/fitness/session/73ce38d4-03fa-4c12-bbdf-b1ea233aeffa?example=retained";
  const result = new URL(
    calendarWorkoutHref(href, "/?date=2026-10-28&view=week"),
    "https://calendar.invalid",
  );
  expect(result.searchParams.get("returnCalendar")).toBe(
    "/?date=2026-10-28&view=week",
  );
  expect(result.searchParams.get("example")).toBe("retained");
  expect(calendarWorkoutHref("/food", "/?date=2026-10-28&view=week")).toBe(
    "/food",
  );
  expect(calendarWorkoutHref(href, "https://evil.invalid")).toBe(href);
});
