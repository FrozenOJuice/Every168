import { commandHeaders } from "./helpers.js";
import { it, expect } from "vitest";
import request from "supertest";
import { testApp, origin } from "./helpers.js";
const { app, signUp } = testApp();
it("persists multi-exercise workouts, keeps snapshots, protects nested IDs and deduplicates time", async () => {
  const a = await signUp(),
    b = await signUp();
  const post = (path: string, input: object, cookie = a.cookie) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(input);
  const put = (path: string, input: object, cookie = a.cookie, version = 1) =>
    request(app)
      .put("/api/v1/" + path)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders(version))
      .send(input);
  const category = await post("categories", { name: "Exercise" }).expect(201);
  const block = await post("time-blocks", {
    title: "Training",
    categoryId: category.body.id,
    startsAt: "2026-09-07T09:00:00Z",
    endsAt: "2026-09-07T10:00:00Z",
  }).expect(201);
  const squat = await post("exercises", { name: "Squat" }).expect(201),
    plank = await post("exercises", { name: "Plank" }).expect(201);
  const start = {
    title: "Test strength",
    startedAt: "2026-09-07T09:00:00Z",
    notes: null,
    linkedTimeBlockId: block.body.id,
  };
  const workout = await post("strength-workouts", start).expect(201);
  let input = {
    ...start,
    endedAt: null as string | null,
    exercises: [
      {
        exerciseId: squat.body.id,
        notes: null,
        sets: [
          { reps: 5, weightKg: 50, durationSeconds: null, completed: true },
          { reps: 6, weightKg: 45, durationSeconds: null, completed: true },
        ],
      },
      {
        exerciseId: plank.body.id,
        notes: null,
        sets: [
          { reps: null, weightKg: null, durationSeconds: 60, completed: true },
        ],
      },
    ],
  };
  const saved = await put("strength-workouts/" + workout.body.id, input).expect(
    200,
  );
  expect(saved.body.exercises).toHaveLength(2);
  expect(saved.body.exercises[0].sets[1].reps).toBe(6);
  input = {
    ...input,
    endedAt: "2026-09-07T10:00:00Z",
    exercises: saved.body.exercises.map(
      (e: {
        id: string;
        exerciseId: string;
        notes: string | null;
        sets: {
          reps: number | null;
          weightKg: number | null;
          durationSeconds: number | null;
          completed: boolean;
        }[];
      }) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        notes: e.notes,
        sets: e.sets.map((s) => ({
          reps: s.reps,
          weightKg: s.weightKg,
          durationSeconds: s.durationSeconds,
          completed: s.completed,
        })),
      }),
    ),
  };
  const renamed = await put("exercises/" + squat.body.id, {
    name: "Renamed squat",
  }).expect(200);
  const finished = await put(
    "strength-workouts/" + workout.body.id,
    input,
    a.cookie,
    saved.body.version,
  ).expect(200);
  expect(finished.body.exercises[0].exerciseNameSnapshot).toBe("Squat");
  const concurrent = await Promise.all([
    put(
      "strength-workouts/" + workout.body.id,
      input,
      a.cookie,
      finished.body.version,
    ),
    put(
      "strength-workouts/" + workout.body.id,
      input,
      a.cookie,
      finished.body.version,
    ),
  ]);
  expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
  const winner = concurrent.find((r) => r.status === 200)!;
  let week = await request(app)
    .get("/api/v1/weeks/2026-09-07")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(week.body.entries).toHaveLength(1);
  expect(week.body.recordedSeconds).toBe(3600);
  expect(week.body.entries[0].categoryId).toBe(category.body.id);
  const progress = await request(app)
    .get("/api/v1/strength-progress/" + squat.body.id)
    .set("Cookie", a.cookie)
    .expect(200);
  expect(progress.body.maxWeightKg).toBe(50);
  expect(progress.body.history.items).toHaveLength(2);
  for (const [family, id] of [
    ["exercises", squat.body.id],
    ["strength-workouts", workout.body.id],
    ["strength-progress", squat.body.id],
  ])
    await request(app)
      .get("/api/v1/" + family + "/" + id)
      .set("Cookie", b.cookie)
      .expect(404);
  await put("strength-workouts/" + workout.body.id, input, b.cookie).expect(
    404,
  );
  await put("exercises/" + squat.body.id, { name: "Stolen" }, b.cookie).expect(
    404,
  );
  await post("exercises/" + squat.body.id + "/archive", {}, b.cookie).expect(
    404,
  );
  await request(app)
    .delete("/api/v1/strength-workouts/" + workout.body.id)
    .set("Cookie", b.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .expect(404);
  await post("strength-workouts", start, b.cookie).expect(404);
  const bWorkout = await post(
    "strength-workouts",
    { ...start, linkedTimeBlockId: null },
    b.cookie,
  ).expect(201);
  await put(
    "strength-workouts/" + bWorkout.body.id,
    { ...input, linkedTimeBlockId: null },
    b.cookie,
  ).expect(404);
  await post("exercises/" + squat.body.id + "/archive", {})
    .set(commandHeaders(renamed.body.version))
    .expect(200);
  await put(
    "strength-workouts/" + workout.body.id,
    input,
    a.cookie,
    winner.body.version,
  ).expect(200);
  await request(app)
    .delete("/api/v1/time-blocks/" + block.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .expect(200);
  const retained = await request(app)
    .get("/api/v1/strength-workouts/" + workout.body.id)
    .set("Cookie", a.cookie)
    .expect(200);
  expect(retained.body.linkedTimeBlockId).toBeNull();
  await request(app)
    .delete("/api/v1/strength-workouts/" + workout.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(retained.body.version))
    .expect(200);
  week = await request(app)
    .get("/api/v1/weeks/2026-09-07")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(week.body.entries).toHaveLength(0);
});
it("logs cardio with/without distance, updates one source entry and removes it atomically", async () => {
  const a = await signUp(),
    b = await signUp();
  const input = {
    activityType: "run",
    title: "Test run",
    startedAt: "2026-09-07T12:00:00Z",
    durationSeconds: 1500,
    distanceMeters: 5000,
    notes: null,
    linkedTimeBlockId: null,
  };
  const created = await request(app)
    .post("/api/v1/cardio-activities")
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send(input)
    .expect(201);
  expect(created.body.paceSecondsPerKm).toBe(300);
  await request(app)
    .get("/api/v1/cardio-activities/" + created.body.id)
    .set("Cookie", b.cookie)
    .expect(404);
  await request(app)
    .put("/api/v1/cardio-activities/" + created.body.id)
    .set("Cookie", b.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send(input)
    .expect(404);
  await request(app)
    .delete("/api/v1/cardio-activities/" + created.body.id)
    .set("Cookie", b.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .expect(404);
  const updated = await request(app)
    .put("/api/v1/cardio-activities/" + created.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({
      ...input,
      activityType: "skip",
      durationSeconds: 600,
      distanceMeters: null,
    })
    .expect(200);
  expect(updated.body.paceSecondsPerKm).toBeNull();
  const week = await request(app)
    .get("/api/v1/weeks/2026-09-07")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(week.body.entries).toHaveLength(1);
  expect(week.body.recordedSeconds).toBe(600);
  await request(app)
    .delete("/api/v1/cardio-activities/" + created.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(updated.body.version))
    .expect(200);
  const empty = await request(app)
    .get("/api/v1/weeks/2026-09-07")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(empty.body.entries).toHaveLength(0);
});

it("rejects stale workout saves without changing persisted sets", async () => {
  const a = await signUp();
  const start = {
    title: "Original",
    startedAt: "2026-09-07T09:00:00Z",
    notes: null,
    linkedTimeBlockId: null,
  };
  const created = await request(app)
    .post("/api/v1/strength-workouts")
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send(start)
    .expect(201);
  const input = {
    ...start,
    title: "New title",
    endedAt: null,
    exercises: [],
  };
  await request(app)
    .put("/api/v1/strength-workouts/" + created.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send(input)
    .expect(200);
  const stale = await request(app)
    .put("/api/v1/strength-workouts/" + created.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ ...input, title: "Stale title" })
    .expect(409);
  expect(stale.body.error.code).toBe("STALE_REVISION");
  const retained = await request(app)
    .get("/api/v1/strength-workouts/" + created.body.id)
    .set("Cookie", a.cookie)
    .expect(200);
  expect(retained.body.title).toBe("New title");
});
