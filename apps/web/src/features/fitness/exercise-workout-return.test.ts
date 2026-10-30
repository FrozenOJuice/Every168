import { expect, it } from "vitest";
import {
  exerciseReturnPath,
  parseExerciseWorkoutReturn,
} from "./exercise-workout-return";
const id = "73ce38d4-03fa-4c12-bbdf-b1ea233aeffa";
it("keeps exercise return routes and captured display mode within Fitness", () => {
  const path = exerciseReturnPath(`/fitness/exercises/${id}`, {
    exerciseId: id,
    mode: "reps_load",
  });
  expect(parseExerciseWorkoutReturn(id, path)).toEqual({
    exerciseId: id,
    href: path,
  });
  expect(
    parseExerciseWorkoutReturn(
      id,
      "/fitness/exercises/catalog/bench-press?mode=duration&untrusted=ignored",
    ),
  ).toEqual({
    exerciseId: id,
    href: "/fitness/exercises/catalog/bench-press?mode=duration",
  });
  expect(
    exerciseReturnPath("/fitness/session/other", {
      exerciseId: id,
      mode: "reps",
    }),
  ).toBe(`/fitness/exercises/${id}?mode=reps`);
});
it("rejects external destinations, unrelated exercises, malformed IDs and route escapes", () => {
  for (const href of [
    "https://example.com",
    "//example.com",
    "/fitness/history",
    `/fitness/exercises/${id}/edit`,
    "/fitness/exercises/73ce38d4-03fa-4c12-bbdf-b1ea233aeffb",
    `/fitness/exercises/${id}/../../history`,
    ["/fitness/exercises/catalog/bench-press"],
  ])
    expect(parseExerciseWorkoutReturn(id, href)).toBeUndefined();
  expect(
    parseExerciseWorkoutReturn("bad", `/fitness/exercises/${id}`),
  ).toBeUndefined();
});
