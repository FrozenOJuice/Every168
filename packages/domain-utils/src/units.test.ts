import { expect, it } from "vitest";
import {
  fromMeters,
  toMeters,
  fromKilograms,
  toKilograms,
  fromSeconds,
  toSeconds,
  type DistanceUnit,
} from "./units";
it("converts distance choices without changing canonical distances", () => {
  expect(toMeters(1, "yd")).toBe(0.9144);
  expect(toMeters(1, "mi")).toBe(1609.344);
  for (const unit of ["m", "km", "yd", "mi"] as DistanceUnit[])
    for (const value of [0, 1, 1234.567])
      expect(toMeters(fromMeters(value, unit), unit)).toBeCloseTo(value, 9);
  expect(toKilograms(fromKilograms(100, "lb"), "lb")).toBeCloseTo(100, 9);
});
it("accepts fractional time units while preserving whole-second boundaries", () => {
  expect(toSeconds(1.5, "min")).toBe(90);
  expect(toSeconds(0.5, "h")).toBe(1800);
  expect(toSeconds(0, "s")).toBe(0);
  for (const unit of ["s", "min", "h"] as const)
    for (const seconds of [1, 59, 90, 86399])
      expect(toSeconds(fromSeconds(seconds, unit), unit)).toBe(seconds);
});
