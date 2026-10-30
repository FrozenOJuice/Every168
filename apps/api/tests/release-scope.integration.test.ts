import { expect, it } from "vitest";
import request from "supertest";
import { testApp, origin, commandHeaders } from "./helpers.js";

const { app, deps, serve, signUp } = testApp("core");
const previewApp = testApp("preview").app;

it("keeps deferred APIs unavailable and excludes retained Food activity without deleting data", async () => {
  const { cookie } = await signUp();
  const preview = await serve({
    config: { ...deps.config, RELEASE_SCOPE: "preview" },
  });
  const post = (path: string, data: object) =>
    request(preview)
      .post(`/api/v1/${path}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(data);
  const food = (
    await post("foods", {
      name: "Retained oats",
      servingAmount: 40,
      servingUnit: "g",
      calories: 100,
    }).expect(201)
  ).body;
  await post("food-entries", {
    foodId: food.id,
    quantity: 1,
    consumedAt: "2026-10-27T12:00:00Z",
  }).expect(201);
  const water = (
    await post("water-entries", {
      amountMl: 250,
      consumedAt: "2026-10-27T12:00:00Z",
    }).expect(201)
  ).body;
  await post("weight-entries", {
    weightKg: 70,
    measuredAt: "2026-10-27T12:00:00Z",
  }).expect(201);

  for (const path of [
    "foods",
    `foods/${food.id}`,
    "food-preparations",
    "food-entries",
    "nutrition/daily?date=2026-10-27",
    "water-entries",
    "hydration/daily?date=2026-10-27",
    "weight-entries",
    "body/weight-review?date=2026-10-27",
    "dashboard",
  ]) {
    await request(app).get(`/api/v1/${path}`).set("Cookie", cookie).expect(404);
  }
  for (const method of ["post", "put", "delete"] as const) {
    await request(app)
      [method](`/api/v1/foods${method === "post" ? "" : `/${food.id}`}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders(food.version))
      .send({})
      .expect(404);
  }
  const activity = (
    await request(app)
      .get("/api/v1/calendar/activity?from=2026-10-27&to=2026-10-27")
      .set("Cookie", cookie)
      .expect(200)
  ).body;
  expect(activity.entries).toEqual([]);
  expect(activity.truncatedSources).toEqual([]);
  await request(preview)
    .get(`/api/v1/foods/${food.id}`)
    .set("Cookie", cookie)
    .expect(200);
  await request(preview)
    .get(`/api/v1/water-entries/${water.id}`)
    .set("Cookie", cookie)
    .expect(200);
  await request(app)
    .get("/api/v1/tasks?date=2026-10-27&view=all")
    .set("Cookie", cookie)
    .expect(404);
  await request(app)
    .get("/api/v1/strength-plans")
    .set("Cookie", cookie)
    .expect(200);
});

it("defers program APIs while retaining preview programs and ordinary workouts", async () => {
  const { cookie } = await signUp();
  const preview = await serve({
    config: { ...deps.config, RELEASE_SCOPE: "preview" },
  });
  const post = (path: string, data: object) =>
    request(preview)
      .post(`/api/v1/${path}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(data);
  const exercise = (
    await post("exercises", {
      name: "Retained movement",
      loggingType: "reps",
    }).expect(201)
  ).body;
  const workout = (
    await post("strength-plans", {
      title: "Retained workout",
      exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
    }).expect(201)
  ).body;
  const program = (
    await post("training-programs", {
      title: "Retained program",
      startDate: "2026-10-28",
      trainingDays: [],
      steps: [{ workoutId: workout.id }],
    }).expect(201)
  ).body;
  for (const path of [
    "training-programs",
    `training-programs/${program.id}`,
    `training-programs/${program.id}/history`,
    `training-program-for-session/${workout.id}`,
  ])
    await request(app).get(`/api/v1/${path}`).set("Cookie", cookie).expect(404);
  for (const [method, suffix] of [
    ["post", ""],
    ["put", `/${program.id}`],
    ["delete", `/${program.id}`],
    ["post", `/${program.id}/begin`],
    ["post", `/${program.id}/schedule`],
    ["post", `/${program.id}/skip`],
    ["post", `/${program.id}/pause`],
  ] as const)
    await request(app)
      [method](`/api/v1/training-programs${suffix}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders(program.version))
      .send({})
      .expect(404);
  await request(preview)
    .get(`/api/v1/training-programs/${program.id}`)
    .set("Cookie", cookie)
    .expect(200);
  await request(app)
    .get(`/api/v1/strength-plans/${workout.id}`)
    .set("Cookie", cookie)
    .expect(200);
});

it("defers all Tasks endpoints and feed contributions while retaining preview data and Calendar time", async () => {
  const { cookie } = await signUp();
  const preview = previewApp;
  const write = async (path: string, data: object, version?: number) => {
    const result = await request(preview)
      [version ? "put" : "post"](`/api/v1/${path}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders(version))
      .send(data);
    expect(result.status).toBe(version ? 200 : 201);
    return result.body;
  };
  const project = await write("task-projects", { name: "Retained project" });
  const task = await write("tasks", {
    title: "Retained task",
    inbox: false,
    plannedDate: "2026-10-27",
    projectId: project.id,
  });
  const schedule = await write(
    `tasks/${task.id}/schedules`,
    { startsAt: "2026-10-27T12:00:00Z", endsAt: "2026-10-27T13:00:00Z" },
    undefined,
  );
  const current = (
    await request(preview)
      .get(`/api/v1/tasks/${task.id}`)
      .set("Cookie", cookie)
      .expect(200)
  ).body.task;
  const time = await request(preview)
    .post(`/api/v1/tasks/${task.id}/times`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .set(commandHeaders(current.version))
    .send({ startsAt: "2026-10-27T12:00:00Z", endsAt: "2026-10-27T13:00:00Z" })
    .expect(201);
  for (const path of [
    "tasks?date=2026-10-27&view=all",
    "tasks/day-links?date=2026-10-27",
    `tasks/${task.id}`,
    `tasks/for-block/${schedule.id}`,
    `tasks/for-time/${time.body.id}`,
    "task-projects",
    `task-projects/${project.id}`,
  ])
    await request(app).get(`/api/v1/${path}`).set("Cookie", cookie).expect(404);
  for (const [method, path] of [
    ["post", "tasks"],
    ["put", `tasks/${task.id}`],
    ["put", `tasks/${task.id}/future`],
    ["put", `tasks/${task.id}/state`],
    ["post", `tasks/${task.id}/duplicate`],
    ["post", `tasks/${task.id}/move`],
    ["delete", `tasks/${task.id}`],
    ["post", `tasks/${task.id}/schedules`],
    ["delete", `task-schedules/${schedule.id}`],
    ["post", `tasks/${task.id}/times`],
    ["put", `task-times/${time.body.id}`],
    ["delete", `task-times/${time.body.id}`],
    ["post", "task-projects"],
    ["put", `task-projects/${project.id}`],
    ["delete", `task-projects/${project.id}`],
  ] as const)
    await request(app)
      [method](`/api/v1/${path}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send({})
      .expect(404);
  const activity = (
    await request(app)
      .get("/api/v1/calendar/activity?from=2026-10-27&to=2026-10-27")
      .set("Cookie", cookie)
      .expect(200)
  ).body;
  expect(activity.entries).toEqual([]);
  expect(activity.truncatedSources).toEqual([]);
  const week = (
    await request(app)
      .get("/api/v1/weeks/2026-10-27")
      .set("Cookie", cookie)
      .expect(200)
  ).body;
  expect(
    week.entries.filter(
      (entry: { sourceType: string }) => entry.sourceType === "task_time",
    ),
  ).toHaveLength(1);
  expect(week.recordedSeconds).toBe(3600);
  expect(week.blocks).toHaveLength(1);
  await request(preview)
    .get(`/api/v1/tasks/${task.id}`)
    .set("Cookie", cookie)
    .expect(200);
  await request(preview)
    .get(`/api/v1/task-projects/${project.id}`)
    .set("Cookie", cookie)
    .expect(200);
  const previewFeed = (
    await request(preview)
      .get("/api/v1/calendar/activity?from=2026-10-27&to=2026-10-27")
      .set("Cookie", cookie)
      .expect(200)
  ).body;
  expect(
    previewFeed.entries.some(
      (entry: { domain: string }) => entry.domain === "Tasks",
    ),
  ).toBe(true);
});
