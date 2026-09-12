import { commandHeaders } from "./helpers.js";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import { origin, testApp } from "./helpers.js";

const { app, signUp } = testApp();
const instant = "2026-09-12T10:00:00Z";

it("requires a session on every registered domain route", async () => {
  const paths = await readdir("src/modules", { recursive: true });
  let count = 0;
  for (const path of paths.filter((path) => path.endsWith(".routes.ts"))) {
    const source = await readFile("src/modules/" + path, "utf8");
    for (const [, method, route] of source.matchAll(
      /\b(?:r|router)\.(get|post|put|delete)\(\s*"([^"]+)"/g,
    )) {
      const concrete = route!
        .replace(":id", randomUUID())
        .replace(":date", "2026-09-12");
      const response = await request(app)
        [method as "get" | "post" | "put" | "delete"]("/api/v1" + concrete)
        .set("Origin", origin)
        .set(commandHeaders())
        .timeout({ response: 3000, deadline: 5000 });
      expect(
        response.status,
        method +
          " " +
          concrete +
          ": " +
          response.text +
          " " +
          JSON.stringify(response.headers),
      ).toBe(401);
      count++;
    }
  }
  expect(count).toBeGreaterThan(50);
});

it("rejects ownership mass assignment across every create/update family and isolates lists and summaries", async () => {
  const a = await signUp(),
    b = await signUp();
  const post = (path: string, input: object, cookie = a.cookie) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Origin", origin)
      .set(commandHeaders())
      .set("Cookie", cookie)
      .send(input);
  const foodInput = {
    name: "Private food",
    servingAmount: 1,
    servingUnit: "serving",
    calories: 99,
  };
  const food = await post("foods", foodInput).expect(201);
  const entryInput = { consumedAt: instant, quantity: 1, mealType: "lunch" };
  const families: {
    path: string;
    input: object;
    update?: object;
    list?: string;
  }[] = [
    {
      path: "categories",
      input: { name: "Private category" },
      list: "categories",
    },
    { path: "goals", input: { title: "Private goal" }, list: "goals" },
    {
      path: "time-blocks",
      input: {
        title: "Private block",
        startsAt: instant,
        endsAt: "2026-09-12T11:00:00Z",
      },
    },
    {
      path: "time-entries",
      input: {
        title: "Private time",
        startsAt: instant,
        endsAt: "2026-09-12T11:00:00Z",
      },
    },
    { path: "foods", input: foodInput, list: "foods" },
    {
      path: "food-entries",
      input: { ...entryInput, foodId: food.body.id },
      update: entryInput,
    },
    {
      path: "water-entries",
      input: { amountMl: 250, consumedAt: instant },
      list: "water-entries",
    },
    {
      path: "weight-entries",
      input: { weightKg: 71, measuredAt: instant },
      list: "weight-entries",
    },
    {
      path: "exercises",
      input: { name: "Private exercise" },
      list: "exercises",
    },
    {
      path: "strength-workouts",
      input: { title: "Private workout", startedAt: instant },
      update: {
        title: "Private workout",
        startedAt: instant,
        endedAt: null,
        exercises: [],
      },
      list: "strength-workouts",
    },
    {
      path: "cardio-activities",
      input: {
        title: "Private cardio",
        activityType: "run",
        startedAt: instant,
        durationSeconds: 600,
      },
      list: "cardio-activities",
    },
  ];
  for (const { path, input, update, list } of families) {
    await post(path, { ...input, userId: b.id }).expect(422);
    const own = await post(path, input).expect(201);
    const detail = "/api/v1/" + path + "/" + own.body.id;
    const before = await request(app).get(detail).set("Cookie", a.cookie);
    expect(before.status, detail + ": " + JSON.stringify(before.body)).toBe(
      200,
    );
    await request(app)
      .put(detail)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send({ ...(update ?? input), userId: b.id })
      .expect(422);
    await request(app)
      .get(detail)
      .set("Cookie", b.cookie)
      .set("X-User-ID", a.id)
      .query({ userId: a.id })
      .expect(404);
    expect(
      (await request(app).get(detail).set("Cookie", a.cookie).expect(200)).body,
    ).toEqual(before.body);
    if (list) {
      const result = await request(app)
        .get("/api/v1/" + list)
        .set("Cookie", b.cookie)
        .query({ userId: a.id, limit: 1 })
        .expect(200);
      expect(result.body.items ?? result.body).toEqual([]);
      expect(result.headers["cache-control"]).toBe("no-store");
    }
    if (path === "food-entries")
      await post(
        path + "/" + own.body.id + "/repeat",
        entryInput,
        b.cookie,
      ).expect(404);
  }
  for (const path of [
    "weeks/2026-09-12",
    "nutrition/daily?date=2026-09-12",
    "hydration/daily?date=2026-09-12",
    "dashboard?date=2026-09-12",
  ]) {
    const other = await request(app)
      .get("/api/v1/" + path)
      .set("Cookie", b.cookie)
      .query({ userId: a.id })
      .expect(200);
    expect(JSON.stringify(other.body)).not.toContain("Private");
    expect(other.headers["cache-control"]).toBe("no-store");
  }
  const preferences = {
    timezone: "UTC",
    weekStartsOn: 1,
    weightUnit: "kg",
    distanceUnit: "km",
  };
  await request(app)
    .put("/api/v1/preferences")
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ ...preferences, userId: b.id })
    .expect(422);
});

it("cannot reuse a foreign nested exercise ID even with an owned exercise and workout", async () => {
  const a = await signUp(),
    b = await signUp();
  const post = (path: string, input: object, cookie: string) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Origin", origin)
      .set(commandHeaders())
      .set("Cookie", cookie)
      .send(input);
  const put = (id: string, input: object, cookie: string) =>
    request(app)
      .put("/api/v1/strength-workouts/" + id)
      .set("Origin", origin)
      .set(commandHeaders())
      .set("Cookie", cookie)
      .send(input);
  const start = { startedAt: instant, title: "Private workout" };
  const exerciseA = await post(
    "exercises",
    { name: "Private squat" },
    a.cookie,
  ).expect(201);
  const exerciseB = await post(
    "exercises",
    { name: "Own squat" },
    b.cookie,
  ).expect(201);
  const workoutA = await post("strength-workouts", start, a.cookie).expect(201);
  const workoutB = await post("strength-workouts", start, b.cookie).expect(201);
  const input = {
    ...start,
    endedAt: null,
    exercises: [{ exerciseId: exerciseA.body.id, sets: [{ reps: 5 }] }],
  };
  const saved = await put(workoutA.body.id, input, a.cookie).expect(200);
  await put(
    workoutB.body.id,
    {
      ...input,
      exercises: [
        {
          id: saved.body.exercises[0].id,
          exerciseId: exerciseB.body.id,
          sets: [{ reps: 99 }],
        },
      ],
    },
    b.cookie,
  ).expect(404);
  expect(
    (
      await request(app)
        .get("/api/v1/strength-workouts/" + workoutA.body.id)
        .set("Cookie", a.cookie)
        .expect(200)
    ).body,
  ).toEqual(saved.body);
  expect(
    (
      await request(app)
        .get("/api/v1/strength-workouts/" + workoutB.body.id)
        .set("Cookie", b.cookie)
        .expect(200)
    ).body.exercises,
  ).toEqual([]);
});
