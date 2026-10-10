import { describe, expect, it, vi } from "vitest";
import { blockSchema } from "@168hours/contracts";
import {
  currentHourMinute,
  editorTimes,
  elapsedMilliseconds,
  endAfter,
  inputAtMinute,
} from "./calendar-times";

const timezone = "America/Edmonton";
describe("calendar time drafts", () => {
  it("uses the current account-local hour rather than the system timezone or a fixed morning default", () => {
    expect(currentHourMinute("2026-10-08T02:37:00Z", timezone)).toBe(20 * 60);
    expect(currentHourMinute("2026-10-08T02:37:00Z", "Asia/Kolkata")).toBe(
      8 * 60,
    );
    expect(currentHourMinute("2026-11-01T08:37:00Z", timezone)).toBe(60);
  });
  it("defaults to the current hour on the requested date and carries the end into tomorrow", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-09T05:37:00Z"));
      expect(
        editorTimes({ kind: "block", date: "2026-09-07" }, timezone),
      ).toEqual({
        startsAt: "2026-09-07T23:00",
        endsAt: "2026-09-08T00:00",
        duration: 3600000,
      });
    } finally {
      vi.useRealTimers();
    }
  });
  it("prefills quarter-hour creation across midnight", () => {
    expect(inputAtMinute("2026-09-07", 1440)).toBe("2026-09-08T00:00");
    expect(
      editorTimes(
        { kind: "block", date: "2026-09-07", minute: 1425 },
        timezone,
      ),
    ).toEqual({
      startsAt: "2026-09-07T23:45",
      endsAt: "2026-09-08T00:45",
      duration: 3600000,
    });
  });
  it("preserves elapsed duration through spring and fall clock changes", () => {
    expect(endAfter("2026-03-08T01:30", 3600000, timezone)).toBe(
      "2026-03-08T03:30",
    );
    expect(endAfter("2026-11-01T00:30", 10800000, timezone)).toBe(
      "2026-11-01T02:30",
    );
    expect(
      elapsedMilliseconds("2026-11-01T00:30", "2026-11-01T02:30", timezone),
    ).toBe(10800000);
  });
  it("leaves nonexistent or ambiguous starts for explicit validation", () => {
    expect(() => endAfter("2026-03-08T02:15", 3600000, timezone)).toThrow();
    expect(() => endAfter("2026-11-01T01:15", 3600000, timezone)).toThrow();
    expect(
      editorTimes({ kind: "block", date: "2026-03-08", minute: 135 }, timezone)
        .startsAt,
    ).toBe("2026-03-08T02:15");
  });
  it("opens a duplicate on the next local date, preserving an overnight duration without changing its source", () => {
    const source = blockSchema.parse({
      seriesId: null,
      occurrenceDate: null,
      isException: false,
      id: "00000000-0000-4000-8000-000000000001",
      version: 3,
      title: "Overnight reading",
      startsAt: "2026-09-14T05:30:00Z",
      endsAt: "2026-09-14T07:00:00Z",
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
      notes: "Read",
      categoryId: null,
      goalId: null,
    });
    expect(
      editorTimes(
        { kind: "block", date: "2026-09-13", duplicateOf: source },
        timezone,
      ),
    ).toEqual({
      startsAt: "2026-09-14T23:30",
      endsAt: "2026-09-15T01:00",
      duration: 5400000,
    });
    expect(source.startsAt).toBe("2026-09-14T05:30:00Z");
    expect(source.version).toBe(3);
  });
});
