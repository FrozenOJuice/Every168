import { commandHeaders } from "./helpers.js";
import { it, expect } from "vitest";
import request from "supertest";
import { testApp, origin } from "./helpers.js";
const { app, signUp } = testApp();
it("preserves food snapshots, distinguishes missing nutrients, and isolates foods and entries", async () => {
  const a = await signUp(),
    b = await signUp();
  const post = (path: string, data: object, cookie = a.cookie) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(data);
  const input = {
    name: "Test oats",
    servingAmount: 40,
    servingUnit: "g",
    calories: 150,
    proteinG: 5,
    carbsG: null,
    fatG: 0,
    fiberG: null,
  };
  const food = await post("foods", input).expect(201);
  const log = {
    foodId: food.body.id,
    quantity: 2,
    mealType: "breakfast",
    consumedAt: "2026-09-12T12:00:00Z",
  };
  const entry = await post("food-entries", log).expect(201);
  const changed = await request(app)
    .put("/api/v1/foods/" + food.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ ...input, name: "Changed oats", calories: 999 })
    .expect(200);
  const daily = await request(app)
    .get("/api/v1/nutrition/daily?date=2026-09-12")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(daily.body.entries[0].nameSnapshot).toBe("Test oats");
  expect(daily.body.totals.calories.value).toBe(300);
  expect(daily.body.totals.carbsG).toEqual({ value: null, unknownCount: 1 });
  expect(daily.body.totals.fatG.value).toBe(0);
  for (const [family, id, data] of [
    ["foods", food.body.id, input],
    [
      "food-entries",
      entry.body.id,
      { quantity: 1, mealType: "lunch", consumedAt: log.consumedAt },
    ],
  ] as const) {
    await request(app)
      .get("/api/v1/" + family + "/" + id)
      .set("Cookie", b.cookie)
      .expect(404);
    await request(app)
      .put("/api/v1/" + family + "/" + id)
      .set("Cookie", b.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(data)
      .expect(404);
  }
  await post("food-entries", log, b.cookie).expect(404);
  await post("foods/" + food.body.id + "/archive", {}, b.cookie).expect(404);
  await request(app)
    .delete("/api/v1/food-entries/" + entry.body.id)
    .set("Cookie", b.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .expect(404);
  await post("foods/" + food.body.id + "/archive", {})
    .set(commandHeaders(changed.body.version))
    .expect(200);
  await post("food-entries", log).expect(422);
  const copy = await post("food-entries/" + entry.body.id + "/repeat", {
    quantity: 1,
    mealType: "snack",
    consumedAt: log.consumedAt,
  }).expect(201);
  expect(copy.body.caloriesSnapshot).toBe(150);
  const updated = await request(app)
    .put("/api/v1/food-entries/" + entry.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ quantity: 3, mealType: "lunch", consumedAt: log.consumedAt })
    .expect(200);
  await request(app)
    .delete("/api/v1/food-entries/" + entry.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(updated.body.version))
    .expect(200);
});
it("logs, edits, paginates and isolates water/weight; dashboard shows real data only", async () => {
  const a = await signUp(),
    b = await signUp();
  const first = await request(app)
    .get("/api/v1/dashboard")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(first.body.water.totalMl).toBeNull();
  expect(first.body.weight).toBeNull();
  expect(first.body.nutrition.count).toBe(0);
  for (const [family, input, field] of [
    [
      "water-entries",
      { amountMl: 250, consumedAt: new Date().toISOString() },
      "amountMl",
    ],
    [
      "weight-entries",
      { weightKg: 70, measuredAt: new Date().toISOString() },
      "weightKg",
    ],
  ] as const) {
    const created = await request(app)
      .post("/api/v1/" + family)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(input)
      .expect(201);
    await request(app)
      .get("/api/v1/" + family + "/" + created.body.id)
      .set("Cookie", b.cookie)
      .expect(404);
    await request(app)
      .put("/api/v1/" + family + "/" + created.body.id)
      .set("Cookie", b.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(input)
      .expect(404);
    await request(app)
      .delete("/api/v1/" + family + "/" + created.body.id)
      .set("Cookie", b.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .expect(404);
    const update = await request(app)
      .put("/api/v1/" + family + "/" + created.body.id)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send({ ...input, [field]: field === "amountMl" ? 500 : 71 })
      .expect(200);
    expect(update.body[field]).toBe(field === "amountMl" ? 500 : 71);
    const second = await request(app)
      .post("/api/v1/" + family)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(input)
      .expect(201);
    const page = await request(app)
      .get("/api/v1/" + family + "?limit=1")
      .set("Cookie", a.cookie)
      .expect(200);
    expect(page.body.nextCursor).toBeTruthy();
    const next = await request(app)
      .get("/api/v1/" + family + "?limit=1&cursor=" + page.body.nextCursor)
      .set("Cookie", a.cookie)
      .expect(200);
    expect(next.body.items[0].id).not.toBe(page.body.items[0].id);
    await request(app)
      .delete("/api/v1/" + family + "/" + second.body.id)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .expect(200);
  }
  const dashboard = await request(app)
    .get("/api/v1/dashboard")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(dashboard.body.water.totalMl).toBe(500);
  expect(dashboard.body.weight.weightKg).toBe(71);
  const other = await request(app)
    .get("/api/v1/dashboard")
    .set("Cookie", b.cookie)
    .expect(200);
  expect(other.body.water.totalMl).toBeNull();
  expect(other.body.weight).toBeNull();
});
