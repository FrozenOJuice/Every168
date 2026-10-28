import { expect, it } from "vitest";
import request from "supertest";
import { testApp, origin, commandHeaders } from "./helpers.js";

const { app, deps, serve, signUp } = testApp("core");

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
    .expect(200);
  await request(app)
    .get("/api/v1/strength-plans")
    .set("Cookie", cookie)
    .expect(200);
});
