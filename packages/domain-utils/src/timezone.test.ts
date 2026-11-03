import { describe, expect, it } from "vitest";
import {
  dayRange,
  weekRange,
  localInputToInstant,
  instantToLocalInput,
  localDate,
  localMinute,
  plannedInstant,
  shiftPlannedTime,
} from "./time";
import { expandPlannedSeries } from "./series";
import {
  isTimezone,
  zonedDateTimeFormat,
  timezoneDataVersion,
} from "./timezone";

describe("pinned timezone rules", () => {
  it("keeps Edmonton at UTC-6 after November 1 regardless of host tzdb", () => {
    expect(timezoneDataVersion).toBe("2026f");
    for (const timezone of ["America/Edmonton", "Canada/Mountain"]) {
      expect(localInputToInstant("2026-11-02T09:00", timezone)).toBe(
        "2026-11-02T15:00:00Z",
      );
      expect(plannedInstant("2026-11-02", 540, timezone)).toBe(
        "2026-11-02T15:00:00Z",
      );
      expect(instantToLocalInput("2026-11-02T15:00:00Z", timezone)).toBe(
        "2026-11-02T09:00",
      );
      expect(localMinute("2026-11-02T15:00:00Z", timezone)).toBe(540);
      expect(localDate("2026-11-02T06:30:00Z", timezone)).toBe("2026-11-02");
      expect(dayRange("2026-11-01", timezone)).toEqual({
        startsAt: "2026-11-01T06:00:00Z",
        endsAt: "2026-11-02T06:00:00Z",
      });
      const week = weekRange("2026-11-01", timezone, 0);
      expect(
        (Date.parse(week.endsAt) - Date.parse(week.startsAt)) / 3600000,
      ).toBe(168);
    }
  });
  it("uses the same rules for labels, local midnight and other changed Canadian zones", () => {
    expect(
      zonedDateTimeFormat("America/Edmonton", {
        hour: "numeric",
        minute: "2-digit",
      }).format("2026-11-02T15:00:00Z"),
    ).toMatch(/^9:00\sAM$/);
    expect(
      zonedDateTimeFormat("America/Edmonton", {
        hour: "numeric",
        timeZoneName: "short",
      }).format("2026-11-02T15:00:00Z"),
    ).not.toContain("UTC");
    expect(localInputToInstant("2026-11-02T09:00", "America/Vancouver")).toBe(
      "2026-11-02T16:00:00Z",
    );
    expect(localInputToInstant("2026-11-02T09:00", "America/Winnipeg")).toBe(
      "2026-11-02T14:00:00Z",
    );
    expect(isTimezone("Canada/Mountain")).toBe(true);
    expect(isTimezone("UTC")).toBe(true);
    expect(isTimezone("Invalid/Timezone")).toBe(false);
    expect(() =>
      localInputToInstant("2026-11-02T09:00", "Invalid/Timezone"),
    ).toThrow();
  });
  it("retains historical and seasonal DST ambiguity rules instead of globally fixing an offset", () => {
    expect(() =>
      localInputToInstant("2025-11-02T01:30", "America/Edmonton"),
    ).toThrow();
    expect(() =>
      localInputToInstant("2026-03-08T02:30", "America/Edmonton"),
    ).toThrow();
    expect(localInputToInstant("2026-11-01T01:30", "America/Edmonton")).toBe(
      "2026-11-01T07:30:00Z",
    );
    expect(() =>
      localInputToInstant("2026-11-01T01:30", "America/Denver"),
    ).toThrow();
    expect(plannedInstant("2026-11-01", 90, "America/Denver")).toBe(
      "2026-11-01T07:30:00Z",
    );
    expect(plannedInstant("2026-03-08", 150, "America/Denver")).toBeNull();
    expect(() =>
      localInputToInstant("2026-04-05T01:45", "Australia/Lord_Howe"),
    ).toThrow();
    expect(() =>
      localInputToInstant("2026-10-04T02:15", "Australia/Lord_Howe"),
    ).toThrow();
    expect(localInputToInstant("2026-11-02T09:00", "Asia/Kathmandu")).toBe(
      "2026-11-02T03:15:00Z",
    );
    expect(localInputToInstant("2026-11-02T09:00:00.123456789", "UTC")).toBe(
      "2026-11-02T09:00:00.123456789Z",
    );
  });
  it("starts days correctly when midnight or an entire date is skipped", () => {
    expect(dayRange("2026-09-06", "America/Santiago")).toEqual({
      startsAt: "2026-09-06T04:00:00Z",
      endsAt: "2026-09-07T03:00:00Z",
    });
    expect(dayRange("2011-12-30", "Pacific/Apia")).toEqual({
      startsAt: "2011-12-30T10:00:00Z",
      endsAt: "2011-12-30T10:00:00Z",
    });
  });
  it("preserves local recurrence times and elapsed move durations across rule changes", () => {
    const entries = expandPlannedSeries({
      startDate: "2026-10-31",
      untilDate: "2026-11-03",
      startMinute: 540,
      durationMinutes: 60,
      frequency: "daily",
      interval: 1,
      weekdays: [],
      timezone: "America/Edmonton",
    });
    expect(entries.occurrences.map((entry) => entry.startsAt)).toEqual([
      "2026-10-31T15:00:00Z",
      "2026-11-01T15:00:00Z",
      "2026-11-02T15:00:00Z",
      "2026-11-03T15:00:00Z",
    ]);
    expect(
      shiftPlannedTime(
        "2026-10-31T15:00:00Z",
        "2026-10-31T16:30:00Z",
        2,
        0,
        "America/Edmonton",
      ),
    ).toEqual({
      startsAt: "2026-11-02T15:00:00Z",
      endsAt: "2026-11-02T16:30:00.000Z",
    });
  });
});
