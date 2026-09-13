import { describe, expect, it } from "vitest";
import { blockSchema } from "@168hours/contracts";
import {
  editorTimes,
  elapsedMilliseconds,
  endAfter,
  inputAtMinute,
} from "./calendar-times";

const timezone = "America/Edmonton";
describe("calendar time drafts", () => {
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
