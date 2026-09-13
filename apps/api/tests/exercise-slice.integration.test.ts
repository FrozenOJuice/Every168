import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import { workoutSchema, workoutUpdateInput } from "@168hours/contracts";
import { commandHeaders, origin, testApp } from "./helpers.js";

const { app, signUp } = testApp();
function client(cookie: string) {
  return {
    get: (path: string) =>
      request(app)
        .get("/api/v1/" + path)
        .set("Cookie", cookie),
    write: (
      method: "post" | "put",
      path: string,
      data: object,
      version = 1,
      key?: string,
    ) => {
      const result = request(app)
        [method]("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version));
      if (key) result.set("Idempotency-Key", key);
      return result.send(data);
    },
  };
}
const start = {
  title: "Strength session",
  startedAt: "2026-09-07T09:00:00Z",
  notes: null,
  linkedTimeBlockId: null,
};
function draft(body: unknown) {
  const w = workoutSchema.parse(body);
  return workoutUpdateInput.parse({
    title: w.title,
    startedAt: w.startedAt,
    endedAt: w.endedAt,
    notes: w.notes,
    linkedTimeBlockId: w.linkedTimeBlockId,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        id: s.id,
        reps: s.reps,
        weightKg: s.weightKg,
        durationSeconds: s.durationSeconds,
        completed: s.completed,
      })),
    })),
  });
}

it("keeps set identities and pagination stable through corrections, and rejects foreign or duplicated set IDs", async () => {
  const a = client((await signUp()).cookie);
  const b = client((await signUp()).cookie);
  const exercise = await a
    .write("post", "exercises", { name: "Loaded squat" })
    .expect(201);
  const timed = await a
    .write("post", "exercises", { name: "Hold" })
    .expect(201);
  const w = await a.write("post", "strength-workouts", start).expect(201);
  const saved = await a
    .write("put", "strength-workouts/" + w.body.id, {
      ...start,
      endedAt: "2026-09-07T10:00:00Z",
      exercises: [
        {
          exerciseId: exercise.body.id,
          sets: [
            { reps: 5, weightKg: 40 },
            { reps: 8, weightKg: 30 },
            { reps: 2, weightKg: 100, completed: false },
          ],
        },
        { exerciseId: timed.body.id, sets: [{ durationSeconds: 30 }] },
      ],
    })
    .expect(200);
  const first = await a
    .get("strength-progress/" + exercise.body.id + "?limit=1")
    .expect(200);
  expect(first.body.maxWeightKg).toBe(40);
  const original = workoutSchema.parse(saved.body);
  const input = draft(saved.body);
  input.exercises[0]!.sets.reverse();
  input.notes = "Corrected notes";
  const key = randomUUID();
  const corrected = await a
    .write(
      "put",
      "strength-workouts/" + w.body.id,
      input,
      saved.body.version,
      key,
    )
    .expect(200);
  const replay = await a
    .write(
      "put",
      "strength-workouts/" + w.body.id,
      input,
      saved.body.version,
      key,
    )
    .expect(200);
  expect(replay.body).toEqual(corrected.body);
  for (const exercise of workoutSchema.parse(corrected.body).exercises) {
    for (const set of exercise.sets) {
      const old = original.exercises
        .flatMap((e) => e.sets)
        .find((s) => s.id === set.id)!;
      expect(set.createdAt).toBe(old.createdAt);
      expect(set.version).toBeGreaterThan(old.version);
    }
  }
  const next = await a
    .get("strength-progress/" + exercise.body.id)
    .query({ limit: 1, cursor: first.body.history.nextCursor })
    .expect(200);
  expect(next.body.history.items).toHaveLength(1);
  expect(next.body.history.items[0].id).not.toBe(
    first.body.history.items[0].id,
  );
  const unknown = await a.get("strength-progress/" + timed.body.id).expect(200);
  expect(unknown.body.maxWeightKg).toBeNull();
  const invalid = draft(corrected.body);
  invalid.exercises[0]!.sets.push(invalid.exercises[0]!.sets[0]!);
  await a
    .write(
      "put",
      "strength-workouts/" + w.body.id,
      invalid,
      corrected.body.version,
    )
    .expect(422);
  const swapped = draft(corrected.body);
  swapped.exercises[0]!.sets[0]!.id = swapped.exercises[1]!.sets[0]!.id;
  await a
    .write(
      "put",
      "strength-workouts/" + w.body.id,
      swapped,
      corrected.body.version,
    )
    .expect(404);
  const otherExercise = await b
    .write("post", "exercises", { name: "Other exercise" })
    .expect(201);
  const other = await b.write("post", "strength-workouts", start).expect(201);
  await b
    .write("put", "strength-workouts/" + other.body.id, {
      ...start,
      endedAt: null,
      exercises: [
        {
          exerciseId: otherExercise.body.id,
          sets: [input.exercises[0]!.sets[0]!],
        },
      ],
    })
    .expect(404);
  const retained = await a.get("strength-workouts/" + w.body.id).expect(200);
  expect(retained.body).toEqual(corrected.body);
  const week = await a.get("weeks/2026-09-07").expect(200);
  expect(week.body.entries).toHaveLength(1);
  expect(week.body.recordedSeconds).toBe(3600);
});

it("restores owned exercises with revision protection and preserves archived history snapshots", async () => {
  const a = client((await signUp()).cookie);
  const b = client((await signUp()).cookie);
  const exercise = await a
    .write("post", "exercises", { name: "100%_\\ hold" })
    .expect(201);
  await a.write("post", "exercises", { name: "Another hold" }).expect(201);
  const literal = await a
    .get("exercises")
    .query({ search: "%_\\" })
    .expect(200);
  expect(literal.body.items.map((e: { id: string }) => e.id)).toEqual([
    exercise.body.id,
  ]);
  const w = await a.write("post", "strength-workouts", start).expect(201);
  const saved = await a
    .write("put", "strength-workouts/" + w.body.id, {
      ...start,
      endedAt: "2026-09-07T10:00:00Z",
      exercises: [
        { exerciseId: exercise.body.id, sets: [{ durationSeconds: 30 }] },
      ],
    })
    .expect(200);
  const archived = await a
    .write("post", "exercises/" + exercise.body.id + "/archive", {})
    .expect(200);
  await b
    .write(
      "post",
      "exercises/" + exercise.body.id + "/restore",
      {},
      archived.body.version,
    )
    .expect(404);
  await a
    .write("post", "exercises/" + exercise.body.id + "/restore", {}, 1)
    .expect(409);
  await a
    .write(
      "put",
      "strength-workouts/" + w.body.id,
      {
        ...draft(saved.body),
        exercises: [
          {
            exerciseId: exercise.body.id,
            notes: null,
            sets: [{ durationSeconds: 30 }],
          },
        ],
      },
      saved.body.version,
    )
    .expect(422);
  const edited = await a
    .write(
      "put",
      "strength-workouts/" + w.body.id,
      { ...draft(saved.body), notes: "Still editable" },
      saved.body.version,
    )
    .expect(200);
  await a
    .write(
      "put",
      "exercises/" + exercise.body.id,
      { name: "Renamed hold" },
      archived.body.version,
    )
    .expect(200);
  const definition = await a.get("exercises/" + exercise.body.id).expect(200);
  const restored = await a
    .write(
      "post",
      "exercises/" + exercise.body.id + "/restore",
      {},
      definition.body.version,
    )
    .expect(200);
  expect(restored.body.archivedAt).toBeNull();
  expect(edited.body.exercises[0].exerciseNameSnapshot).toBe("100%_\\ hold");
});

it("filters and paginates workout/cardio history within the account", async () => {
  const a = client((await signUp()).cookie);
  const b = client((await signUp()).cookie);
  for (let i = 0; i < 3; i++)
    await a
      .write("post", "strength-workouts", {
        ...start,
        title: "100%_ training " + i,
      })
      .expect(201);
  await a
    .write("post", "strength-workouts", { ...start, title: "Unmatched" })
    .expect(201);
  await b
    .write("post", "strength-workouts", { ...start, title: "100%_ foreign" })
    .expect(201);
  const first = await a
    .get("strength-workouts")
    .query({ search: "%_", status: "active", limit: 2 })
    .expect(200);
  expect(first.body.items).toHaveLength(2);
  const next = await a
    .get("strength-workouts")
    .query({
      search: "%_",
      status: "active",
      limit: 2,
      cursor: first.body.nextCursor,
    })
    .expect(200);
  expect(next.body.items).toHaveLength(1);
  expect(
    new Set(
      [...first.body.items, ...next.body.items].map(
        (w: { id: string }) => w.id,
      ),
    ).size,
  ).toBe(3);
  expect(
    (await a.get("strength-workouts?status=completed").expect(200)).body.items,
  ).toEqual([]);
  await a.get("strength-workouts?status=invalid").expect(422);
  for (const type of ["run", "walk", "skip"])
    await a
      .write("post", "cardio-activities", {
        ...start,
        title: "100%_ cardio",
        activityType: type,
        durationSeconds: 30,
      })
      .expect(201);
  await b
    .write("post", "cardio-activities", {
      ...start,
      title: "100%_ cardio",
      activityType: "run",
      durationSeconds: 30,
    })
    .expect(201);
  const run = await a
    .get("cardio-activities")
    .query({ activityType: "run", search: "%_" })
    .expect(200);
  expect(run.body.items).toHaveLength(1);
  expect(run.body.items[0].distanceMeters).toBeNull();
  expect(run.body.items[0].paceSecondsPerKm).toBeNull();
  await a.get("cardio-activities?activityType=invalid").expect(422);
});
