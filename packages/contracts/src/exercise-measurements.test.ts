import { normalizeMeasurementOverride } from "./exercise";
import { expect, it } from "vitest";
import {
  exerciseLoggingTypeSchema,
  measurementsFor,
  measurementSetKey,
  setInput,
} from "./exercise";
it("round-trips every nonempty measurement selection to a canonical key", () => {
  expect(exerciseLoggingTypeSchema.options).toHaveLength(31);
  for (const type of exerciseLoggingTypeSchema.options) {
    const fields = measurementsFor(type);
    expect(new Set(fields).size).toBe(fields.length);
    expect(measurementSetKey([...fields].reverse())).toBe(type);
  }
  expect(measurementSetKey(["load", "duration", "reps"])).toBe(
    "reps_duration_load",
  );
  expect(() => measurementSetKey([])).toThrow();
  expect(exerciseLoggingTypeSchema.safeParse("load_reps").success).toBe(false);
});

it("allows known zero load alone but rejects completion with no measurements", () => {
  expect(setInput.safeParse({ weightKg: 0, completed: true }).success).toBe(
    true,
  );
  expect(setInput.safeParse({ completed: true }).success).toBe(false);
});

it("matching measurement selections return to inheritance", () => {
  expect(normalizeMeasurementOverride("reps_load", "reps_load")).toBeNull();
  expect(normalizeMeasurementOverride("duration", "reps_load")).toBe(
    "duration",
  );
  expect(normalizeMeasurementOverride(undefined, "duration")).toBeNull();
});
