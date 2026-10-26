import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import {
  workoutSchema,
  workoutUpdateInput,
  exerciseReportSchema,
} from "@168hours/contracts";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, signUp } = testApp();
function client(cookie: string) {
  return {
    get: (path: string) =>
      request(app).get(`/api/v1/${path}`).set("Cookie", cookie),
    write: (
      path: string,
      data: object = {},
      version = 1,
      method: "post" | "put" = "post",
      key = randomUUID(),
    ) =>
      request(app)
        [method](`/api/v1/${path}`)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({ ...commandHeaders(version), "Idempotency-Key": key })
        .send(data),
  };
}
it("keeps activity, intent and measurements independent through programs, scheduling, completion, progress and repetition", async () => {
  const a = client((await signUp()).cookie);
  const swim = (
    await a
      .write("exercises", {
        name: "Swimming",
        loggingType: "distance_duration",
        intentTags: [" Technique ", "TECHNIQUE"],
      })
      .expect(201)
  ).body;
  expect(swim.intentTags).toEqual(["technique"]);
  const lift = (await a.write("exercises", { name: "Squat" }).expect(201)).body;
  const plan = (
    await a
      .write("strength-plans", {
        title: "Mixed practice",
        exercises: [
          {
            exerciseId: swim.id,
            loggingType: "laps_duration",
            intentTags: ["recovery"],
            sets: [
              {
                targetLaps: 10,
                targetDistanceMeters: 250,
                targetDurationSeconds: 600,
              },
            ],
          },
          {
            exerciseId: lift.id,
            intentTags: ["strength"],
            sets: [{ targetReps: 5, targetWeightKg: 40 }],
          },
        ],
      })
      .expect(201)
  ).body;
  const program = (
    await a
      .write("training-programs", {
        title: "Mixed program",
        startDate: "2026-10-01",
        steps: [{ workoutId: plan.id }],
      })
      .expect(201)
  ).body;
  await a
    .write(
      `exercises/${swim.id}`,
      {
        name: "Renamed swim",
        loggingType: "duration",
        intentTags: ["endurance"],
      },
      swim.version,
      "put",
    )
    .expect(200);
  const scheduled = (
    await a
      .write(
        `strength-plans/${plan.id}/schedule`,
        { startsAt: "2026-10-20T12:00:00Z", endsAt: "2026-10-20T13:00:00Z" },
        plan.version,
      )
      .expect(201)
  ).body;
  const scheduledWorkout = (
    await a
      .write(
        `strength-plans/${scheduled.id}/begin`,
        { startedAt: "2026-10-20T12:00:00Z" },
        scheduled.version,
      )
      .expect(201)
  ).body;
  expect(scheduledWorkout.exercises[0]).toMatchObject({
    loggingType: "laps_duration",
    intentTags: ["recovery"],
    exerciseNameSnapshot: "Swimming",
  });
  let w = workoutSchema.parse(
    (
      await a
        .write(
          `training-programs/${program.id}/begin`,
          { sequence: 0, startedAt: "2026-10-21T12:00:00Z" },
          program.version,
        )
        .expect(201)
    ).body,
  );
  expect(w.exercises[0]!.sets[0]).toMatchObject({
    targetLaps: 10,
    targetDistanceMeters: 250,
    distanceMeters: null,
    laps: null,
    completed: false,
  });
  const input = workoutUpdateInput.parse({
    title: w.title,
    startedAt: w.startedAt,
    endedAt: "2026-10-21T13:00:00Z",
    exercises: w.exercises.map((e, index) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      loggingType: index ? "reps_load" : "distance_duration",
      intentTags: index ? [] : ["Technique"],
      sets: [
        {
          id: e.sets[0]!.id,
          ...(index
            ? { reps: 5, weightKg: 0 }
            : { distanceMeters: 500, laps: 20, durationSeconds: 900 }),
        },
      ],
    })),
  });
  w = workoutSchema.parse(
    (
      await a
        .write(`strength-workouts/${w.id}`, input, w.version, "put")
        .expect(200)
    ).body,
  );
  expect(w.exercises[0]).toMatchObject({
    intentTags: ["technique"],
    loggingType: "distance_duration",
  });
  expect(w.exercises[1]!.intentTags).toEqual([]);
  expect(
    (await a.get(`training-programs/${program.id}`)).body.completedCount,
  ).toBe(1);
  const report = exerciseReportSchema.parse(
    (
      await a
        .get(
          `fitness-progress/exercises/${swim.id}?loggingType=distance_duration`,
        )
        .expect(200)
    ).body,
  );
  expect(report.records.map((r) => [r.metric, r.value]).sort()).toEqual([
    ["distance", 500],
    ["duration", 900],
  ]);
  expect(report.sessions.items[0]).toMatchObject({
    maxDistanceMeters: 500,
    maxLaps: null,
    volumeKg: null,
  });
  const key = randomUUID();
  const repeat = workoutSchema.parse(
    (
      await a
        .write(`strength-workouts/${w.id}/repeat`, {}, w.version, "post", key)
        .expect(201)
    ).body,
  );
  expect(
    (
      await a
        .write(`strength-workouts/${w.id}/repeat`, {}, w.version, "post", key)
        .expect(201)
    ).body.id,
  ).toBe(repeat.id);
  expect(repeat.exercises[0]).toMatchObject({
    intentTags: ["technique"],
    loggingType: "distance_duration",
  });
  expect(repeat.exercises[0]!.sets[0]).toMatchObject({
    targetDistanceMeters: 500,
    targetLaps: 20,
    distanceMeters: null,
    laps: null,
    completed: false,
  });
});
it("accepts distance-only and laps-only completed sets, keeps unknowns, and scopes all references", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const e = (
    await a
      .write("exercises", {
        name: "Pool practice",
        loggingType: "laps_duration",
      })
      .expect(201)
  ).body;
  const w = (
    await a
      .write("strength-workouts", { startedAt: "2026-10-21T12:00:00Z" })
      .expect(201)
  ).body;
  const input = {
    title: w.title,
    startedAt: w.startedAt,
    endedAt: "2026-10-21T13:00:00Z",
    exercises: [
      {
        exerciseId: e.id,
        intentTags: ["skill"],
        sets: [
          { laps: 8 },
          { distanceMeters: 50 },
          { targetLaps: 100, completed: false, skipped: true },
        ],
      },
    ],
  };
  const saved = (
    await a
      .write(`strength-workouts/${w.id}`, input, w.version, "put")
      .expect(200)
  ).body;
  const report = exerciseReportSchema.parse(
    (await a.get(`fitness-progress/exercises/${e.id}`)).body,
  );
  expect(report.records.map((r) => [r.metric, r.value]).sort()).toEqual([
    ["laps", 8],
  ]);
  expect(report.sessions.items[0]).toMatchObject({
    completedSets: 2,
    maxDurationSeconds: null,
    maxLaps: 8,
  });
  const comparison = (await a.get(`fitness-progress/workouts/${w.id}`)).body;
  expect(comparison.current.exercises[0]).toMatchObject({
    maxLaps: 8,
    maxDistanceMeters: null,
  });
  await b.get(`fitness-progress/exercises/${e.id}`).expect(404);
  await b
    .write("strength-plans", {
      title: "Foreign",
      exercises: [{ exerciseId: e.id, sets: [{ targetLaps: 8 }] }],
    })
    .expect(404);
  await b
    .write(`strength-workouts/${w.id}`, input, saved.version, "put")
    .expect(404);
  await a
    .write(`strength-workouts/${w.id}`, input, w.version, "put")
    .expect(409);
  for (const set of [
    { distanceMeters: 0 },
    { distanceMeters: -1 },
    { laps: 1.5 },
    { laps: 10001 },
    { targetDistanceMeters: -1, completed: false },
  ]) {
    await a
      .write(
        `strength-workouts/${w.id}`,
        { ...input, exercises: [{ exerciseId: e.id, sets: [set] }] },
        saved.version,
        "put",
      )
      .expect(422);
  }
  for (const intentTags of [Array(9).fill("tag"), ["x".repeat(33)], [""]])
    await a
      .write("exercises", { name: "Invalid tags", intentTags })
      .expect(422);
});
