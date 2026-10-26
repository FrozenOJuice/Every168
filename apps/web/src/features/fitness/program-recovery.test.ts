import { expect, it } from "vitest";
import { recoverProgram } from "./program-recovery";
const initial = {
  title: "Program",
  notes: null,
  startDate: "2026-10-25",
  trainingDays: [1],
  paused: false,
  steps: [{ workoutId: "workout" }],
};
it("ignores empty, malformed, and unchanged drafts regardless of object key order", () => {
  for (const raw of [
    null,
    "bad",
    "{}",
    JSON.stringify({ version: 1, input: initial }),
  ])
    expect(recoverProgram(raw, initial, 1)).toBeNull();
});
it("recovers incomplete editing state but marks conflicting versions", () => {
  const input = { ...initial, title: "", startDate: "", steps: [] };
  const raw = JSON.stringify({ version: 1, input });
  expect(recoverProgram(raw, initial, 1)).toEqual({ input, conflict: false });
  expect(recoverProgram(raw, initial, 2)).toEqual({ input, conflict: true });
});
