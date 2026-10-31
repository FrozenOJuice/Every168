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

it("defers every template endpoint while retaining preview data and Calendar copying", async () => {
  const { cookie } = await signUp();
  const post = (server: typeof app, path: string, data: object) =>
    request(server)
      .post(`/api/v1/${path}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(data);
  const plan = (
    await post(app, "time-blocks", {
      title: "Retained template source",
      startsAt: "2026-10-27T12:00:00Z",
      endsAt: "2026-10-27T13:00:00Z",
    }).expect(201)
  ).body;
  const template = (
    await post(previewApp, "calendar/templates", {
      name: "Retained template",
      sourceDate: "2026-10-27",
      span: "day",
    }).expect(201)
  ).body;
  for (const path of [
    "calendar/templates",
    `calendar/templates/${template.id}`,
    `calendar/templates/${template.id}/preview?targetDate=2026-10-28`,
  ])
    await request(app).get(`/api/v1/${path}`).set("Cookie", cookie).expect(404);
  for (const [method, path] of [
    ["post", "calendar/templates"],
    ["put", `calendar/templates/${template.id}`],
    ["delete", `calendar/templates/${template.id}`],
    ["post", `calendar/templates/${template.id}/apply`],
  ] as const)
    await request(app)
      [method](`/api/v1/${path}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders(template.version))
      .send({})
      .expect(404);
  const retained = (
    await request(previewApp)
      .get(`/api/v1/calendar/templates/${template.id}`)
      .set("Cookie", cookie)
      .expect(200)
  ).body;
  expect(retained.name).toBe("Retained template");
  expect(retained.version).toBe(template.version);
  await request(app)
    .get(`/api/v1/time-blocks/${plan.id}`)
    .set("Cookie", cookie)
    .expect(200);
  const copy = {
    span: "single",
    sourceDate: "2026-10-27",
    sourceId: plan.id,
    sourceKind: "block",
    targetDate: "2026-10-28",
  };
  const preview = (
    await request(app)
      .get(`/api/v1/calendar/copy-preview?${new URLSearchParams(copy)}`)
      .set("Cookie", cookie)
      .expect(200)
  ).body;
  await post(app, "calendar/copy", { ...copy, token: preview.token }).expect(
    201,
  );
});

it("gates standalone planning features and shared unscheduled operations while preserving all-day data", async () => {
  const { cookie } = await signUp();
  const write = (
    server: typeof app,
    path: string,
    data: object,
    method: "post" | "put" = "post",
    version = 1,
  ) =>
    request(server)
      [method](`/api/v1/${path}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders(version))
      .send(data);
  const goal = (
    await write(previewApp, "goals", { title: "Retained goal" }).expect(201)
  ).body;
  const routine = (
    await write(previewApp, "routines", {
      name: "Retained routine",
      steps: ["First step"],
    }).expect(201)
  ).body;
  const input = {
    title: "Deferred backlog",
    kind: "unscheduled",
    date: null,
    endDate: null,
  };
  const backlog = (await write(previewApp, "calendar/items", input).expect(201))
    .body;
  const dated = (
    await write(previewApp, "calendar/items", {
      ...input,
      title: "Deferred dated",
      date: "2026-10-27",
    }).expect(201)
  ).body;
  const allDay = (
    await write(app, "calendar/items", {
      title: "Core all day",
      kind: "all_day",
      date: "2026-10-27",
      endDate: "2026-10-27",
    }).expect(201)
  ).body;
  for (const path of [
    "goals",
    `goals/${goal.id}`,
    "routines",
    `routines/${routine.id}`,
    "calendar/backlog",
    `calendar/items/${backlog.id}`,
    `calendar/items/${dated.id}`,
    "cardio-activities",
  ])
    await request(app).get(`/api/v1/${path}`).set("Cookie", cookie).expect(404);
  for (const [path, data] of [
    ["goals", { title: "No goal" }],
    ["routines", { name: "No routine", steps: [] }],
    ["calendar/items", input],
    [
      `calendar/items/${backlog.id}/schedule`,
      {
        title: "No schedule",
        startsAt: "2026-10-27T12:00:00Z",
        endsAt: "2026-10-27T13:00:00Z",
      },
    ],
  ] as const)
    await write(app, path, data).expect(404);
  await write(
    app,
    `calendar/items/${allDay.id}`,
    { ...input, date: "2026-10-27" },
    "put",
    allDay.version,
  ).expect(404);
  for (const item of [backlog, dated]) {
    await write(
      app,
      `calendar/items/${item.id}`,
      { ...input, title: "Do not update" },
      "put",
      item.version,
    ).expect(404);
    await request(app)
      .delete(`/api/v1/calendar/items/${item.id}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders(item.version))
      .expect(404);
    await request(previewApp)
      .get(`/api/v1/calendar/items/${item.id}`)
      .set("Cookie", cookie)
      .expect(200);
  }
  const range = (
    await request(app)
      .get("/api/v1/calendar/items?from=2026-10-27&to=2026-10-27")
      .set("Cookie", cookie)
      .expect(200)
  ).body;
  expect(range.map((row: { id: string }) => row.id)).toEqual([allDay.id]);
  const search = (
    await request(app)
      .get("/api/v1/calendar/search?kind=all")
      .set("Cookie", cookie)
      .expect(200)
  ).body;
  expect(
    search.items.some(
      (row: { kind: string; item: { kind?: string } }) =>
        row.kind === "item" && row.item.kind === "unscheduled",
    ),
  ).toBe(false);
  await request(app)
    .get("/api/v1/calendar/search?kind=unscheduled")
    .set("Cookie", cookie)
    .expect(404);
  for (const path of [`goals/${goal.id}`, `routines/${routine.id}`])
    for (const method of ["put", "delete"] as const)
      await request(app)
        [method](`/api/v1/${path}`)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders())
        .send({})
        .expect(404);
});
