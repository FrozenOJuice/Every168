import { describe, it, expect } from "vitest";
import {
  weekRange,
  intervalCoverage,
  overlaps,
  clippedSeconds,
  localInputToInstant,
} from "./time";
import {
  toKilograms,
  fromKilograms,
  toMeters,
  fromMeters,
  paceSecondsPerKm,
} from "./units";
describe("calendar time", () => {
  it("handles 167/169 hour DST weeks in local calendar time", () => {
    const spring = weekRange("2026-03-08", "America/Edmonton", 1),
      fall = weekRange("2026-11-01", "America/Edmonton", 1);
    expect(
      (Date.parse(spring.endsAt) - Date.parse(spring.startsAt)) / 3600000,
    ).toBe(167);
    expect(
      (Date.parse(fall.endsAt) - Date.parse(fall.startsAt)) / 3600000,
    ).toBe(169);
    expect(spring.weekStart).toBe("2026-03-02");
    expect(weekRange("2026-03-08", "America/Edmonton", 0).weekStart).toBe(
      "2026-03-08",
    );
  });
  it("rejects nonexistent and ambiguous local times rather than shifting them silently", () => {
    expect(() =>
      localInputToInstant("2026-03-08T02:30", "America/Edmonton"),
    ).toThrow();
    expect(() =>
      localInputToInstant("2026-11-01T01:30", "America/Edmonton"),
    ).toThrow();
  });
  it("clips and unions overlapping intervals", () => {
    const range = {
        startsAt: "2026-09-07T00:00:00Z",
        endsAt: "2026-09-07T04:00:00Z",
      },
      a = { startsAt: "2026-09-06T23:00:00Z", endsAt: "2026-09-07T02:00:00Z" },
      b = { startsAt: "2026-09-07T01:00:00Z", endsAt: "2026-09-07T03:00:00Z" };
    expect(intervalCoverage([a, b], range)).toBe(10800);
    expect(clippedSeconds(a, range)).toBe(7200);
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(a, { ...b, startsAt: a.endsAt })).toBe(false);
    expect(intervalCoverage([], range)).toBe(0);
  });
});
describe("units", () => {
  it("round-trips canonical units", () => {
    expect(fromKilograms(toKilograms(180, "lb"), "lb")).toBeCloseTo(180);
    expect(fromMeters(toMeters(3, "mi"), "mi")).toBeCloseTo(3);
  });
  it("only derives pace for meaningful activities and known positive distances", () => {
    expect(paceSecondsPerKm("run", 1500, 5000)).toBe(300);
    expect(paceSecondsPerKm("skip", 600, null)).toBeNull();
    expect(paceSecondsPerKm("run", 600, 0)).toBeNull();
  });
});
