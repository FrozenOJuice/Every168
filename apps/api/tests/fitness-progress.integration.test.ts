import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import {
  exerciseReportSchema,
  setInput,
  weightRecordsSchema,
  workoutRecordsSchema,
  fitnessOverviewSchema,
  workoutComparisonSchema,
  workoutUpdateInput,
  type Workout,
  type WorkoutUpdateInput,
} from "@168hours/contracts";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, signUp } = testApp();
function client(cookie: string) {
  return {
    get: (path: string) =>
      request(app)
        .get("/api/v1/" + path)
        .set("Cookie", cookie),
    write: (
      method: "post" | "put" | "delete",
      path: string,
      data: object = {},
      version = 1,
    ) =>
      request(app)
        [method]("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({ ...commandHeaders(version), "Idempotency-Key": randomUUID() })
        .send(data),
  };
}
type Client = ReturnType<typeof client>;
async function workout(
  a: Client,
  exerciseId: string,
  startedAt: string,
  sets: object[],
  options: { mode?: string; active?: boolean; title?: string } = {},
): Promise<Workout> {
  const { body: w } = await a
    .write("post", "strength-workouts", {
      title: options.title ?? "Training",
      startedAt,
    })
    .expect(201);
  return (
    await a
      .write(
        "put",
        `strength-workouts/${w.id}`,
        {
          title: w.title,
          startedAt,
          endedAt: options.active
            ? null
            : new Date(Date.parse(startedAt) + 3600000).toISOString(),
          exercises: [
            { exerciseId, loggingType: options.mode ?? "reps_load", sets },
          ],
        },
        w.version,
      )
      .expect(200)
  ).body;
}
async function correct(
  a: Client,
  w: Workout,
  change: (input: WorkoutUpdateInput) => void,
) {
  const input = workoutUpdateInput.parse({
    title: w.title,
    notes: w.notes,
    startedAt: w.startedAt,
    endedAt: w.endedAt,
    linkedTimeBlockId: w.linkedTimeBlockId,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      loggingType: e.loggingType,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        ...Object.fromEntries(
          Object.keys(setInput.shape).map((key) => [
            key,
            s[key as keyof typeof s],
          ]),
        ),
        id: s.id,
        reps: s.reps,
        weightKg: s.weightKg,
        durationSeconds: s.durationSeconds,
        completed: s.completed,
        skipped: s.skipped,
      })),
    })),
  });
  change(input);
  return (
    await a
      .write("put", `strength-workouts/${w.id}`, input, w.version)
      .expect(200)
  ).body as Workout;
}
it("summarizes local weeks across DST without counting targets, active or skipped sets, and retains unknown/zero volume", async () => {
  const a = client((await signUp()).cookie);
  const me = (await a.get("me")).body;
  await a
    .write(
      "put",
      "preferences",
      {
        timezone: "America/Vancouver",
        weekStartsOn: 0,
        weightUnit: "lb",
        distanceUnit: "km",
      },
      me.preferences.version,
    )
    .expect(200);
  const { body: e } = await a
    .write("post", "exercises", { name: "Weekly squat" })
    .expect(201);
  await workout(a, e.id, "2026-03-08T07:59:00Z", [{ reps: 1, weightKg: 999 }]);
  const w = await workout(a, e.id, "2026-03-08T08:00:00Z", [
    { reps: 10, weightKg: 20, targetWeightKg: 1000 },
    { reps: 8, weightKg: null },
    { reps: 5, weightKg: 0 },
    { reps: 100, weightKg: 100, completed: false, skipped: true },
    { reps: 100, weightKg: 100, completed: false },
  ]);
  await workout(a, e.id, "2026-03-15T07:00:00Z", [{ reps: 1, weightKg: 999 }]);
  await workout(
    a,
    e.id,
    "2026-03-10T12:00:00Z",
    [{ durationSeconds: 30, weightKg: 100 }],
    { mode: "duration_load" },
  );
  await workout(
    a,
    e.id,
    "2026-03-11T12:00:00Z",
    [{ reps: 10, weightKg: 500 }],
    { active: true },
  );
  const overview = fitnessOverviewSchema.parse(
    (await a.get("fitness-progress?date=2026-03-11").expect(200)).body,
  );
  expect(overview.weekStart).toBe("2026-03-08");
  expect(overview.weeks).toHaveLength(12);
  expect(overview.weeks.at(-1)).toMatchObject({
    workoutCount: 2,
    durationSeconds: 7200,
    completedSets: 4,
    volumeKg: 200,
    missingVolumeSets: 1,
  });
  const updated = await correct(a, w, (v) => {
    v.exercises[0]!.sets[0]!.weightKg = 30;
  });
  expect(
    (await a.get("fitness-progress?date=2026-03-11")).body.weeks.at(-1)
      .volumeKg,
  ).toBe(300);
  await a
    .write("delete", `strength-workouts/${w.id}`, {}, updated.version)
    .expect(200);
  expect(
    (await a.get("fitness-progress?date=2026-03-11")).body.weeks.at(-1),
  ).toMatchObject({ workoutCount: 1, volumeKg: null, missingVolumeSets: 0 });
});
it("returns chronological session trends and all-time records with source sets, separated by captured tracking type", async () => {
  const a = client((await signUp()).cookie);
  const { body: e } = await a
    .write("post", "exercises", { name: "Records" })
    .expect(201);
  const later = await workout(a, e.id, "2026-10-20T12:00:00Z", [
    { reps: 8, weightKg: 50 },
  ]);
  const earlier = await workout(a, e.id, "2026-10-10T12:00:00Z", [
    { reps: 12, weightKg: 50 },
    { reps: 5, weightKg: 0 },
  ]);
  await workout(
    a,
    e.id,
    "2026-10-22T12:00:00Z",
    [{ durationSeconds: 60, weightKg: 100 }],
    { mode: "duration_load" },
  );
  await workout(
    a,
    e.id,
    "2026-10-23T12:00:00Z",
    [{ reps: 50, weightKg: 500 }],
    { active: true },
  );
  const first = exerciseReportSchema.parse(
    (await a.get(`fitness-progress/exercises/${e.id}?limit=1`).expect(200))
      .body,
  );
  expect(first.sessions.items[0]?.id).toBe(later.id);
  expect(first.sessions.items[0]?.sets).toMatchObject([
    { reps: 8, weightKg: 50 },
  ]);
  expect(first.records.find((r) => r.metric === "load")).toMatchObject({
    value: 50,
    workoutId: earlier.id,
    setId: earlier.exercises[0]!.sets[0]!.id,
  });
  expect(first.records.some((r) => r.metric === "setVolume")).toBe(false);
  const second = exerciseReportSchema.parse(
    (
      await a
        .get(
          `fitness-progress/exercises/${e.id}?limit=1&cursor=${first.sessions.nextCursor}`,
        )
        .expect(200)
    ).body,
  );
  expect(second.sessions.items[0]?.id).toBe(earlier.id);
  expect(second.sessions.items[0]?.volumeKg).toBe(600);
  expect(second.sessions.items[0]?.sets).toMatchObject([
    { reps: 12, weightKg: 50 },
    { reps: 5, weightKg: 0 },
  ]);
  expect(second.sessions.nextCursor).toBeNull();
  const timed = exerciseReportSchema.parse(
    (
      await a
        .get(`fitness-progress/exercises/${e.id}?loggingType=duration_load`)
        .expect(200)
    ).body,
  );
  expect(timed.records.map((r) => [r.metric, r.value])).toEqual([
    ["load", 100],
    ["duration", 60],
  ]);
  expect(timed.sessions.items[0]?.volumeKg).toBeNull();
  await a.write("post", `exercises/${e.id}/archive`, {}, e.version).expect(200);
  expect(
    (await a.get("fitness-progress/exercises?search=Records")).body.items[0],
  ).toMatchObject({
    id: e.id,
    archived: true,
    latest: {
      loggingType: "duration_load",
      sets: [{ durationSeconds: 60, weightKg: 100 }],
    },
  });
  expect(
    (await a.get(`fitness-progress/exercises/${e.id}`)).body.records,
  ).toHaveLength(2);
  await a
    .write("delete", `strength-workouts/${earlier.id}`, {}, earlier.version)
    .expect(200);
  expect(
    (await a.get(`fitness-progress/exercises/${e.id}`)).body.records.find(
      (r: { metric: string }) => r.metric === "load",
    ).workoutId,
  ).toBe(later.id);
});
it("preserves empty and unknown values and supports reps and duration-only records", async () => {
  const a = client((await signUp()).cookie);
  const { body: e } = await a
    .write("post", "exercises", { name: "Unknown load" })
    .expect(201);
  expect(
    (await a.get(`fitness-progress/exercises/${e.id}`).expect(200)).body,
  ).toMatchObject({ records: [], sessions: { items: [], nextCursor: null } });
  await workout(a, e.id, "2026-10-10T12:00:00Z", [{ reps: 8 }]);
  let report = (await a.get(`fitness-progress/exercises/${e.id}`)).body;
  expect(report.sessions.items[0]).toMatchObject({
    volumeKg: null,
    missingVolumeSets: 1,
    maxWeightKg: null,
  });
  expect(report.records.map((r: { metric: string }) => r.metric)).toEqual([
    "reps",
  ]);
  await workout(a, e.id, "2026-10-11T12:00:00Z", [{ reps: 10, weightKg: 0 }]);
  report = (await a.get(`fitness-progress/exercises/${e.id}`)).body;
  expect(
    report.records.find((r: { metric: string }) => r.metric === "load").value,
  ).toBe(0);
  expect(report.sessions.items[0].volumeKg).toBe(0);
  for (const mode of ["reps", "duration"] as const) {
    await workout(
      a,
      e.id,
      "2026-10-12T12:00:00Z",
      [{ reps: 20, durationSeconds: 40, weightKg: 900 }],
      { mode },
    );
    report = (
      await a.get(`fitness-progress/exercises/${e.id}?loggingType=${mode}`)
    ).body;
    expect(report.records.map((r: { metric: string }) => r.metric)).toEqual([
      mode === "reps" ? "reps" : "duration",
    ]);
    expect(report.sessions.items[0]).toMatchObject({
      volumeKg: null,
      maxWeightKg: null,
    });
  }
});
it("compares repeated workouts by exercise identities and modes rather than mutable names or titles", async () => {
  const a = client((await signUp()).cookie);
  const { body: e } = await a
    .write("post", "exercises", { name: "Squat" })
    .expect(201);
  const prior = await workout(
    a,
    e.id,
    "2026-10-10T12:00:00Z",
    [{ reps: 8, weightKg: 40 }],
    { title: "Original title" },
  );
  await workout(a, e.id, "2026-10-11T12:00:00Z", [{ reps: 8 }], {
    mode: "reps",
  });
  const { body: other } = await a
    .write("post", "exercises", { name: "Squat" })
    .expect(201);
  await workout(a, other.id, "2026-10-12T12:00:00Z", [
    { reps: 8, weightKg: 70 },
  ]);
  const current = await workout(
    a,
    e.id,
    "2026-10-13T12:00:00Z",
    [{ reps: 10, weightKg: 50 }, { reps: 8 }],
    { title: "New title" },
  );
  await workout(a, e.id, "2026-10-14T12:00:00Z", [{ reps: 8, weightKg: 90 }]);
  const comparison = workoutComparisonSchema.parse(
    (await a.get(`fitness-progress/workouts/${current.id}`).expect(200)).body,
  );
  expect(comparison.previous?.id).toBe(prior.id);
  expect(comparison.current.exercises[0]).toMatchObject({
    completedSets: 2,
    volumeKg: 500,
    missingVolumeSets: 1,
  });
  expect(comparison.previous?.exercises[0]).toMatchObject({ volumeKg: 320 });
  expect(
    (await a.get(`fitness-progress/workouts/${prior.id}`)).body.previous,
  ).toBeNull();
});
it("scopes every progress read and reference to its owner and rejects malformed queries", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const { body: e } = await a
    .write("post", "exercises", { name: "Private exercise" })
    .expect(201);
  const w = await workout(a, e.id, "2026-10-13T12:00:00Z", [
    { reps: 10, weightKg: 50 },
  ]);
  await b.get(`fitness-progress/exercises/${e.id}`).expect(404);
  await b.get(`fitness-progress/workouts/${w.id}`).expect(404);
  expect((await b.get("fitness-progress/exercises")).body.items).toEqual([]);
  expect(
    (await b.get("fitness-progress?date=2026-10-13")).body.weeks.every(
      (x: { workoutCount: number }) => x.workoutCount === 0,
    ),
  ).toBe(true);
  const { body: other } = await b
    .write("post", "exercises", { name: "Own exercise" })
    .expect(201);
  await b
    .get(`fitness-progress/exercises/${other.id}?excludeWorkoutId=${w.id}`)
    .expect(404);
  await a.get("fitness-progress?date=invalid").expect(422);
  await a
    .get(`fitness-progress/exercises/${e.id}?loggingType=invalid`)
    .expect(422);
  await a.get(`fitness-progress/exercises/${e.id}?cursor=invalid`).expect(422);
  await request(app).get("/api/v1/fitness-progress").expect(401);
});

it("persists independent measurements through plans and sessions and derives mixed-field metrics", async () => {
  const a = client((await signUp()).cookie);
  const b = client((await signUp()).cookie);
  const { body: exercise } = await a
    .write("post", "exercises", {
      name: "Mixed measurements",
      loggingType: "reps_distance_laps_duration_load",
    })
    .expect(201);
  const { body: plan } = await a
    .write("post", "strength-plans", {
      title: "Mixed workout",
      exercises: [
        {
          exerciseId: exercise.id,
          loggingType: "reps_duration_load",
          sets: [
            { targetReps: 8, targetWeightKg: 20, targetDurationSeconds: 60 },
          ],
        },
      ],
    })
    .expect(201);
  const { body: begun } = await a
    .write(
      "post",
      `strength-plans/${plan.id}/begin`,
      {
        startedAt: "2026-10-20T12:00:00Z",
      },
      plan.version,
    )
    .expect(201);
  expect(begun.exercises[0]).toMatchObject({
    loggingType: "reps_duration_load",
  });
  expect(begun.exercises[0].sets[0]).toMatchObject({
    targetReps: 8,
    targetWeightKg: 20,
    targetDurationSeconds: 60,
  });
  const w = await workout(
    a,
    exercise.id,
    "2026-10-21T12:00:00Z",
    [
      {
        reps: 8,
        weightKg: 20,
        durationSeconds: 60,
        distanceMeters: 100,
        laps: 2,
        completed: true,
      },
    ],
    { mode: "reps_distance_laps_duration_load" },
  );
  const path = `fitness-progress/exercises/${exercise.id}?loggingType=reps_distance_laps_duration_load`;
  const { body: report } = await a.get(path).expect(200);
  expect(report.sessions.items[0]).toMatchObject({
    maxReps: 8,
    maxWeightKg: 20,
    maxDurationSeconds: 60,
    maxDistanceMeters: 100,
    maxLaps: 2,
    volumeKg: 160,
    missingVolumeSets: 0,
  });
  expect(
    report.records.map((r: { metric: string }) => r.metric).sort(),
  ).toEqual(["distance", "duration", "load", "reps"].sort());
  await b.get(path).expect(404);
  const { body: comparison } = await a
    .get(`fitness-progress/workouts/${w.id}`)
    .expect(200);
  expect(comparison.current.exercises[0]).toMatchObject({
    volumeKg: 160,
    maxDurationSeconds: 60,
  });
  await workout(
    a,
    exercise.id,
    "2026-10-22T12:00:00Z",
    [
      {
        weightKg: 0,
        completed: true,
      },
    ],
    { mode: "load" },
  );
  const { body: loadOnly } = await a
    .get(`fitness-progress/exercises/${exercise.id}?loggingType=load`)
    .expect(200);
  expect(loadOnly.sessions.items[0]).toMatchObject({
    maxWeightKg: 0,
    maxReps: null,
    maxDurationSeconds: null,
    volumeKg: null,
  });
});

it("keeps per-set overrides through scheduling, starting and repeating, and reports effective measurements", async () => {
  const a = client((await signUp()).cookie);
  const b = client((await signUp()).cookie);
  const { body: exercise } = await a
    .write("post", "exercises", { name: "Set variants" })
    .expect(201);
  const { body: plan } = await a
    .write("post", "strength-plans", {
      title: "Set variants",
      exercises: [
        {
          exerciseId: exercise.id,
          loggingType: "reps_load",
          sets: [
            {
              measurementOverride: "reps_load",
              targetReps: 8,
              targetWeightKg: 20,
            },
            {
              measurementOverride: "duration",
              targetDurationSeconds: 45,
              targetWeightKg: 20,
            },
          ],
        },
      ],
    })
    .expect(201);
  const { body: scheduled } = await a
    .write(
      "post",
      `strength-plans/${plan.id}/schedule`,
      {
        startsAt: "2026-10-20T12:00:00Z",
        endsAt: "2026-10-20T13:00:00Z",
      },
      plan.version,
    )
    .expect(201);
  expect(scheduled.exercises[0].sets[0].measurementOverride).toBeNull();
  expect(scheduled.exercises[0].sets[1].measurementOverride).toBe("duration");
  const { body: begun } = await a
    .write(
      "post",
      `strength-plans/${scheduled.id}/begin`,
      {
        startedAt: "2026-10-20T12:00:00Z",
      },
      scheduled.version,
    )
    .expect(201);
  expect(begun.exercises[0].sets[1]).toMatchObject({
    measurementOverride: "duration",
    targetDurationSeconds: 45,
    targetWeightKg: 20,
  });
  const w = await workout(a, exercise.id, "2026-10-21T12:00:00Z", [
    {
      measurementOverride: "reps_load",
      reps: 8,
      weightKg: 20,
      completed: true,
    },
    {
      measurementOverride: "duration",
      reps: 100,
      weightKg: 100,
      durationSeconds: 45,
      completed: true,
    },
  ]);
  expect(w.exercises[0]!.sets[0]!.measurementOverride).toBeNull();
  const { body: duration } = await a
    .get(`fitness-progress/exercises/${exercise.id}?loggingType=duration`)
    .expect(200);
  expect(duration.sessions.items[0]).toMatchObject({
    maxDurationSeconds: 45,
    maxReps: null,
    maxWeightKg: null,
    volumeKg: null,
  });
  expect(duration.sessions.items[0].sets[0].position).toBe(1);
  const { body: weighted } = await a
    .get(`fitness-progress/exercises/${exercise.id}?loggingType=reps_load`)
    .expect(200);
  expect(weighted.sessions.items[0]).toMatchObject({
    completedSets: 1,
    volumeKg: 160,
    maxWeightKg: 20,
  });
  const { body: comparison } = await a
    .get(`fitness-progress/workouts/${w.id}`)
    .expect(200);
  expect(comparison.current.exercises[0]).toMatchObject({
    completedSets: 2,
    maxReps: 8,
    maxWeightKg: 20,
    maxDurationSeconds: 45,
    volumeKg: 160,
  });
  const { body: repeated } = await a
    .write("post", `strength-workouts/${w.id}/repeat`, {}, w.version)
    .expect(201);
  expect(repeated.exercises[0].sets[1]).toMatchObject({
    measurementOverride: "duration",
    completed: false,
    durationSeconds: null,
  });
  await b.get(`strength-workouts/${w.id}`).expect(404);
  await a
    .write("post", "strength-plans", {
      title: "Invalid",
      exercises: [
        { exerciseId: exercise.id, sets: [{ measurementOverride: "unknown" }] },
      ],
    })
    .expect(422);
});

it("discovers all recorded measurement combinations while retaining exact filtered statistics and ownership", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const { body: e } = await a
    .write("post", "exercises", { name: "Varied exercise" })
    .expect(201);
  await workout(a, e.id, "2026-10-01T10:00:00Z", [{ reps: 8, weightKg: 30 }]);
  await workout(
    a,
    e.id,
    "2026-10-02T10:00:00Z",
    [{ durationSeconds: 60, reps: 999 }],
    { mode: "duration" },
  );
  const report = exerciseReportSchema.parse(
    (
      await a
        .get(`fitness-progress/exercises/${e.id}?allMeasurements=true`)
        .expect(200)
    ).body,
  );
  expect(report.availableMeasurementTypes.sort()).toEqual([
    "duration",
    "reps_load",
  ]);
  expect(report.sessions.items).toHaveLength(2);
  expect(report.sessions.items[0]!.sets[0]!.loggingType).toBe("duration");
  expect(report.sessions.items[0]!.maxReps).toBeNull();
  expect(report.records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ metric: "reps", value: 8 }),
      expect.objectContaining({ metric: "load", value: 30 }),
      expect.objectContaining({ metric: "duration", value: 60, reps: null }),
    ]),
  );
  expect(report.records).toHaveLength(3);
  const filtered = exerciseReportSchema.parse(
    (
      await a
        .get(`fitness-progress/exercises/${e.id}?loggingType=reps_load`)
        .expect(200)
    ).body,
  );
  expect(filtered.sessions.items).toHaveLength(1);
  expect(filtered.availableMeasurementTypes).toHaveLength(2);
  await b
    .get(`fitness-progress/exercises/${e.id}?allMeasurements=true`)
    .expect(404);
});

it("aligns reordered comparisons by exercise and matches duplicate occurrences without mixing results", async () => {
  const a = client((await signUp()).cookie);
  const { body: first } = await a
    .write("post", "exercises", { name: "First exercise" })
    .expect(201);
  const { body: second } = await a
    .write("post", "exercises", { name: "Second exercise" })
    .expect(201);
  const make = async (
    day: string,
    entries: { exerciseId: string; reps: number }[],
  ) => {
    const { body: w } = await a
      .write("post", "strength-workouts", {
        title: "Order",
        startedAt: `${day}T10:00:00Z`,
      })
      .expect(201);
    return (
      await a
        .write(
          "put",
          `strength-workouts/${w.id}`,
          {
            title: w.title,
            startedAt: w.startedAt,
            endedAt: `${day}T11:00:00Z`,
            exercises: entries.map((e) => ({
              exerciseId: e.exerciseId,
              loggingType: "reps",
              sets: [{ reps: e.reps, completed: true }],
            })),
          },
          w.version,
        )
        .expect(200)
    ).body;
  };
  const previous = await make("2026-10-01", [
    { exerciseId: first.id, reps: 5 },
    { exerciseId: second.id, reps: 20 },
    { exerciseId: first.id, reps: 8 },
  ]);
  const current = await make("2026-10-02", [
    { exerciseId: second.id, reps: 22 },
    { exerciseId: first.id, reps: 6 },
    { exerciseId: first.id, reps: 9 },
  ]);
  const comparison = workoutComparisonSchema.parse(
    (await a.get(`fitness-progress/workouts/${current.id}`).expect(200)).body,
  );
  expect(comparison.previous!.id).toBe(previous.id);
  expect(comparison.previous!.exercises.map((e) => e.maxReps)).toEqual([
    20, 5, 8,
  ]);
  expect(comparison.current.exercises.map((e) => e.maxReps)).toEqual([
    22, 6, 9,
  ]);
});

it("persists deliberately cleared actuals and resets that flag when repeating a session", async () => {
  const a = client((await signUp()).cookie);
  const { body: e } = await a
    .write("post", "exercises", { name: "Cleared results" })
    .expect(201);
  const w = await workout(
    a,
    e.id,
    "2026-10-01T10:00:00Z",
    [{ completed: false, resultsEdited: true, targetReps: 12 }],
    { active: true },
  );
  expect(
    (await a.get(`strength-workouts/${w.id}`).expect(200)).body.exercises[0]
      .sets[0],
  ).toMatchObject({ resultsEdited: true, reps: null, targetReps: 12 });
  const repeat = (
    await a
      .write("post", `strength-workouts/${w.id}/repeat`, {}, w.version)
      .expect(201)
  ).body;
  expect(repeat.exercises[0].sets[0]).toMatchObject({
    resultsEdited: false,
    reps: null,
    targetReps: 12,
  });
});

it("derives reps-at-weight records and session badges from confirmed owned results, recalculating corrections and deletions", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const exercise = (
    await a.write("post", "exercises", { name: "Record press" }).expect(201)
  ).body;
  const early = await workout(a, exercise.id, "2026-10-20T10:00:00Z", [
    { reps: 8, weightKg: 50, completed: true },
    { reps: 10, weightKg: 40, completed: true },
    { reps: 15, weightKg: 0, completed: true },
  ]);
  let later = await workout(a, exercise.id, "2026-10-21T10:00:00Z", [
    { reps: 10, weightKg: 50, completed: true },
    { reps: 12, weightKg: 40, completed: true },
    { reps: 4, weightKg: 60, completed: true },
    { reps: 999, weightKg: 999, completed: false },
    { reps: 999, weightKg: 999, skipped: true, completed: false },
    {
      reps: 999,
      weightKg: 999,
      completed: true,
      measurementOverride: "duration",
      durationSeconds: 30,
    },
  ]);
  const tied = await workout(a, exercise.id, "2026-10-22T10:00:00Z", [
    { reps: 10, weightKg: 50, completed: true },
  ]);
  await workout(
    a,
    exercise.id,
    "2026-10-23T10:00:00Z",
    [{ reps: 100, weightKg: 100, completed: true }],
    { active: true },
  );
  const path = `fitness-progress/exercises/${exercise.id}/weight-records`;
  const firstPage = weightRecordsSchema.parse(
    (await a.get(path + "?limit=2").expect(200)).body,
  );
  expect(firstPage.items.map((r) => [r.weightKg, r.reps, r.workoutId])).toEqual(
    [
      [60, 4, later.id],
      [50, 10, later.id],
    ],
  );
  expect(firstPage.items.map((record) => record.totalReps)).toEqual([4, 28]);
  expect(firstPage.nextWeight).toBe(50);
  const secondPage = weightRecordsSchema.parse(
    (await a.get(path + "?limit=2&beforeWeight=50").expect(200)).body,
  );
  expect(secondPage.items.map((r) => [r.weightKg, r.reps])).toEqual([
    [40, 12],
    [0, 15],
  ]);
  expect(secondPage.items.map((record) => record.totalReps)).toEqual([22, 15]);
  expect(secondPage.nextWeight).toBeNull();
  const recordsPath = `fitness-progress/workouts/${later.id}/records`;
  const badges = workoutRecordsSchema.parse(
    (await a.get(recordsPath).expect(200)).body,
  ).records;
  expect(badges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        metric: "load",
        value: 60,
        reps: 4,
        first: false,
      }),
      expect.objectContaining({
        metric: "repsAtWeight",
        weightKg: 50,
        value: 10,
        first: false,
      }),
      expect.objectContaining({
        metric: "repsAtWeight",
        weightKg: 60,
        value: 4,
        first: true,
      }),
      expect.objectContaining({
        metric: "duration",
        value: 30,
        reps: null,
        weightKg: null,
        first: true,
      }),
    ]),
  );
  expect(badges.some((r) => r.value === 999)).toBe(false);
  expect(
    (await a.get(`fitness-progress/workouts/${tied.id}/records`).expect(200))
      .body.records,
  ).toEqual([]);
  expect(
    (
      await a.get(`fitness-progress/workouts/${early.id}/records`).expect(200)
    ).body.records.every((r: { first: boolean }) => r.first),
  ).toBe(true);
  await b.get(path).expect(404);
  await b.get(recordsPath).expect(404);
  await a.get(path + "?beforeWeight=-1").expect(422);
  later = await correct(a, later, (input) => {
    input.exercises[0]!.sets[0]!.reps = 7;
  });
  expect(
    (await a.get(path).expect(200)).body.items.find(
      (r: { weightKg: number }) => r.weightKg === 50,
    ).workoutId,
  ).toBe(tied.id);
  await a
    .write("delete", `strength-workouts/${tied.id}`, {}, tied.version)
    .expect(200);
  const updated = (await a.get(path).expect(200)).body.items.find(
    (r: { weightKg: number }) => r.weightKg === 50,
  );
  expect(updated.reps).toBe(8);
  expect(updated.totalReps).toBe(15);
  expect(updated.workoutId).toBe(early.id);
  expect(
    (await a.get(recordsPath).expect(200)).body.records.some(
      (r: { metric: string; weightKg: number }) =>
        r.metric === "repsAtWeight" && r.weightKg === 50,
    ),
  ).toBe(false);
});

it("keeps unfinished and skipped occurrences in finished exercise history without recording their entered values", async () => {
  const a = client((await signUp()).cookie);
  const exercise = (
    await a.write("post", "exercises", { name: "History states" }).expect(201)
  ).body;
  const other = (
    await a
      .write("post", "exercises", { name: "Performed movement" })
      .expect(201)
  ).body;
  let saved = await workout(
    a,
    exercise.id,
    "2026-10-24T10:00:00Z",
    [
      { reps: 100, weightKg: 100, completed: false },
      { reps: 200, weightKg: 200, skipped: true, completed: false },
    ],
    { active: true },
  );
  saved = await correct(a, saved, (input) => {
    input.endedAt = "2026-10-24T11:00:00Z";
    input.exercises.push({
      exerciseId: other.id,
      notes: null,
      loggingType: "reps",
      sets: [setInput.parse({ reps: 5, completed: true })],
    });
    input.notes = "Ended early";
    input.exercises[0]!.notes = "Bench unavailable";
  });
  const report = exerciseReportSchema.parse(
    (
      await a
        .get(`fitness-progress/exercises/${exercise.id}?allMeasurements=true`)
        .expect(200)
    ).body,
  );
  expect(report.records).toEqual([]);
  expect(report.sessions.items).toHaveLength(1);
  expect(report.sessions.items[0]).toMatchObject({
    notes: "Ended early",
    exerciseNotes: ["Bench unavailable"],
    completedSets: 0,
    maxReps: null,
    maxWeightKg: null,
    volumeKg: null,
  });
  expect(report.sessions.items[0]!.sets).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        completed: false,
        skipped: false,
        reps: null,
        weightKg: null,
      }),
      expect.objectContaining({ skipped: true, reps: null, weightKg: null }),
    ]),
  );
  expect(
    (
      await a.get(`fitness-progress/workouts/${saved.id}/records`).expect(200)
    ).body.records.filter(
      (record: { exerciseId: string }) => record.exerciseId === exercise.id,
    ),
  ).toEqual([]);
});
