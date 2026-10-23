import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import {
  exerciseReportSchema,
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
      notes: e.notes,
      sets: e.sets.map((s) => ({
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
  expect(first.records.find((r) => r.metric === "load")).toMatchObject({
    value: 50,
    workoutId: earlier.id,
    setId: earlier.exercises[0]!.sets[0]!.id,
  });
  expect(first.records.find((r) => r.metric === "setVolume")?.value).toBe(600);
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
  ).toMatchObject({ id: e.id, archived: true });
  expect(
    (await a.get(`fitness-progress/exercises/${e.id}`)).body.records,
  ).toHaveLength(3);
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
