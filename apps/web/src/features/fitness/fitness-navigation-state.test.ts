import { expect, it } from "vitest";
import {
  exerciseNode,
  fitnessHref,
  navigationEntrySchema,
  rootPath,
  screenNode,
  visitFitnessNode,
} from "./fitness-navigation-state";
const exerciseId = "73ce38d4-03fa-4c12-bbdf-b1ea233aeffa";
const workoutId = "73ce38d4-03fa-4c12-bbdf-b1ea233aeffb";
const exercise = exerciseNode(`/fitness/exercises/${exerciseId}`, exerciseId);
const workout = screenNode(`/fitness/session/${workoutId}`, "summary");
it("unwinds an existing exercise or workout without losing its original parent and state", () => {
  const root = screenNode("/fitness/history?search=Leg&date=2026-10-26");
  const path = [
    root,
    { ...workout, position: { page: 400, pane: 200, library: 0, builder: 0 } },
    { ...exercise, mode: "reps_load" as const },
  ];
  expect(
    visitFitnessNode(path, screenNode(`${workout.href}?returnTo=other`)),
  ).toEqual({ existing: true, path: path.slice(0, 2) });
  const other = screenNode("/fitness/workout/new", "editor");
  const expanded = visitFitnessNode(path, other);
  expect(expanded.existing).toBe(false);
  expect(visitFitnessNode(expanded.path, exercise)).toEqual({
    existing: true,
    path,
  });
});
it("bounds visits while retaining the root destination", () => {
  const root = screenNode("/fitness/exercises");
  let path = [root];
  for (let i = 0; i < 40; i++)
    path = visitFitnessNode(
      path,
      exerciseNode(
        `/fitness/exercises/catalog/item-${i}`,
        undefined,
        `item-${i}`,
      ),
    ).path;
  expect(path).toHaveLength(24);
  expect(path[0]).toEqual(root);
  expect(path.at(-1)?.catalogKey).toBe("item-39");
});
it("accepts only internal Fitness destinations and validates stored snapshots", () => {
  for (const value of [
    "https://evil.invalid/fitness",
    "//evil.invalid/fitness",
    "/fitness/../tasks",
    "/fitness/exercises/%2e%2e/history",
    "/fitness#fragment",
    "/tasks",
    ["/fitness"],
  ])
    expect(fitnessHref(value)).toBeUndefined();
  expect(
    fitnessHref(
      `${workout.href}?returnHistory=%2Ffitness%2Fhistory%3Fsearch%3DLeg`,
    ),
  ).toBeDefined();
  expect(
    navigationEntrySchema.safeParse({
      token: exerciseId,
      location: workout.href,
      path: [screenNode("https://evil.invalid")],
    }).success,
  ).toBe(false);
  expect(
    navigationEntrySchema.safeParse({
      token: exerciseId,
      location: workout.href,
      path: [{ ...exercise, exerciseId: "bad" }],
    }).success,
  ).toBe(false);
});
it("gives direct links safe defaults and preserves valid exercise and History parents", () => {
  expect(rootPath(workout.href).map((node) => node.href)).toEqual([
    "/fitness/history",
    workout.href,
  ]);
  const query = new URLSearchParams({
    returnExercise: exerciseId,
    returnTo: exercise.href,
  });
  expect(rootPath(`${workout.href}?${query}`).map((node) => node.kind)).toEqual(
    ["screen", "exercise", "screen"],
  );
  expect(
    rootPath(`${workout.href}?returnHistory=https://evil.invalid`)[0]?.href,
  ).toBe("/fitness/history");
  expect(
    rootPath(`/fitness/exercises/catalog/bench-press`)[1]?.catalogKey,
  ).toBe("bench-press");
});
