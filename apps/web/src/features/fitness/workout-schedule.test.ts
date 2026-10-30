import { describe, expect, it } from "vitest";
import {
  initialWorkoutSchedule,
  formatWorkoutScheduleDuration,
  moveWorkoutScheduleStart,
  validateWorkoutSchedule,
} from "./workout-schedule";

describe("workout scheduling dates", () => {
  const zone = "America/Edmonton";
  it("uses the selected local day and handles an overnight default", () => {
    expect(
      initialWorkoutSchedule(
        "2026-10-30",
        new Date("2026-10-28T05:30:00Z"),
        zone,
      ),
    ).toEqual({ start: "2026-10-30T23:30", end: "2026-10-31T00:30" });
  });
  it("rounds up to a quarter hour, keeps exact boundaries and carries midnight", () => {
    expect(
      initialWorkoutSchedule(
        "2026-10-30",
        new Date("2026-10-28T15:07:00Z"),
        zone,
      ),
    ).toEqual({ start: "2026-10-30T09:15", end: "2026-10-30T10:15" });
    expect(
      initialWorkoutSchedule(
        "2026-10-30",
        new Date("2026-10-28T15:15:00Z"),
        zone,
      ).start,
    ).toBe("2026-10-30T09:15");
    expect(
      initialWorkoutSchedule(
        "2026-10-30",
        new Date("2026-10-28T15:15:01Z"),
        zone,
      ).start,
    ).toBe("2026-10-30T09:30");
    expect(
      initialWorkoutSchedule(
        "2026-10-30",
        new Date("2026-10-28T05:53:00Z"),
        zone,
      ),
    ).toEqual({ start: "2026-10-31T00:00", end: "2026-10-31T01:00" });
  });
  it("shows elapsed duration across midnight and clock changes, without a misleading invalid total", () => {
    expect(
      formatWorkoutScheduleDuration(
        { start: "2026-10-30T23:30", end: "2026-10-31T01:00" },
        zone,
      ),
    ).toBe("1 hour 30 minutes");
    expect(
      formatWorkoutScheduleDuration(
        { start: "2026-03-08T01:30", end: "2026-03-08T03:30" },
        zone,
      ),
    ).toBe("1 hour");
    expect(
      formatWorkoutScheduleDuration(
        { start: "2026-10-30T11:00", end: "2026-10-30T10:00" },
        zone,
      ),
    ).toBeNull();
  });
  it("preserves elapsed duration when a start moves across a clock change", () => {
    expect(
      moveWorkoutScheduleStart(
        { start: "2026-03-07T01:30", end: "2026-03-07T02:30" },
        "2026-03-08T01:30",
        zone,
      ),
    ).toEqual({ start: "2026-03-08T01:30", end: "2026-03-08T03:30" });
    expect(
      initialWorkoutSchedule(
        "2026-03-08",
        new Date("2026-03-07T08:30:00Z"),
        zone,
      ).end,
    ).toBe("2026-03-08T03:30");
  });
  it("keeps invalid ranges editable rather than inventing a duration", () => {
    expect(
      moveWorkoutScheduleStart(
        { start: "2026-10-30T11:00", end: "2026-10-30T10:00" },
        "2026-10-31T11:00",
        zone,
      ).end,
    ).toBe("2026-10-30T10:00");
  });
  it("rejects repeated starts and skipped ends at their own fields", () => {
    const repeated = validateWorkoutSchedule(
      { start: "2026-11-01T01:30", end: "2026-11-01T03:00" },
      zone,
    );
    expect(repeated.input).toBeUndefined();
    expect(repeated.errors.start).toContain("clock change");
    expect(repeated.errors.end).toBeUndefined();
    const skipped = validateWorkoutSchedule(
      { start: "2026-03-08T01:30", end: "2026-03-08T02:30" },
      zone,
    );
    expect(skipped.errors.end).toContain("clock change");
    expect(skipped.errors.start).toBeUndefined();
  });
  it("validates order and the canonical maximum, and permits overnight reservations", () => {
    expect(
      validateWorkoutSchedule(
        { start: "2026-10-30T11:00", end: "2026-10-30T10:00" },
        zone,
      ).errors.end,
    ).toBe("End must be after start.");
    expect(
      validateWorkoutSchedule(
        { start: "2026-10-01T11:00", end: "2026-11-20T11:00" },
        zone,
      ).input,
    ).toBeUndefined();
    expect(
      validateWorkoutSchedule(
        { start: "2026-10-30T23:30", end: "2026-10-31T00:30" },
        zone,
      ).input,
    ).toEqual({
      startsAt: "2026-10-31T05:30:00Z",
      endsAt: "2026-10-31T06:30:00Z",
    });
  });
});
