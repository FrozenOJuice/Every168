import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request, { type Response } from "supertest";
import { dayRange } from "@168hours/domain-utils";
import {
  nutritionDailySchema,
  weightReviewSchema,
  waterDailySchema,
} from "@168hours/contracts";
import { testApp, origin, commandHeaders } from "./helpers.js";

const { app, signUp, deps } = testApp();
const foodInput = {
  name: "Label oats",
  servingAmount: 40,
  servingUnit: "g",
  calories: 150,
  proteinG: 5,
  fatG: 0,
};
async function member() {
  const { cookie, id } = await signUp();
  await request(app).get("/api/v1/me").set("Cookie", cookie).expect(200);
  return {
    id,
    read: (path: string) =>
      request(app)
        .get("/api/v1/" + path)
        .set("Cookie", cookie),
    write: (
      method: "post" | "put" | "delete",
      path: string,
      input: object = {},
      version = 1,
      key = randomUUID(),
    ) =>
      request(app)
        [method]("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({ ...commandHeaders(version), "Idempotency-Key": key })
        .send(input),
  };
}

it("searches literal food names and snapshot history with stable, private pagination", async () => {
  const a = await member(),
    b = await member();
  for (const name of [
    "100% oats",
    "100X oats",
    "rice_flour",
    "riceXflour",
    "a\\b",
    "ab",
  ]) {
    const food = await a
      .write("post", "foods", { ...foodInput, name })
      .expect(201);
    await a
      .write("post", "food-entries", {
        foodId: food.body.id,
        quantity: 0.5,
        consumedAt: "2026-09-12T12:00:00Z",
      })
      .expect(201);
  }
  for (const [search, name] of [
    ["%", "100% oats"],
    ["_", "rice_flour"],
    ["\\", "a\\b"],
  ] as const) {
    for (const path of ["foods", "food-entries"]) {
      const result = await a
        .read(path + "?search=" + encodeURIComponent(search))
        .expect(200);
      expect(result.body.items).toHaveLength(1);
      expect(
        result.body.items[0][path === "foods" ? "name" : "nameSnapshot"],
      ).toBe(name);
      expect(
        (
          await b
            .read(path + "?search=" + encodeURIComponent(search))
            .expect(200)
        ).body.items,
      ).toEqual([]);
    }
  }
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const result: Response = await a
      .read("food-entries?limit=2" + (cursor ? "&cursor=" + cursor : ""))
      .expect(200);
    seen.push(...result.body.items.map((e: { id: string }) => e.id));
    expect(result.body.items[0].nutrition.calories.value).toBe(75);
    cursor = result.body.nextCursor;
  } while (cursor);
  expect(seen).toHaveLength(6);
  expect(new Set(seen).size).toBe(6);
  await a.read("food-entries?cursor=bad").expect(422);
  await a.read("food-entries?limit=101").expect(422);
  await a.read("food-entries?date=2026-02-30").expect(422);
  await request(app).get("/api/v1/food-entries").expect(401);
});

it("bounds the weight chart without hiding measurements from paginated history", async () => {
  const a = await member();
  await deps.pool.query(
    "insert into weight_entries(user_id,weight_kg,measured_at) select $1,70,timestamptz '2026-09-01T12:00:00Z'+n*interval '1 minute' from generate_series(1,201) as n",
    [a.id],
  );
  const review = weightReviewSchema.parse(
    (await a.read("body/weight-review?date=2026-09-12").expect(200)).body,
  );
  expect(review.trend.entries).toHaveLength(200);
  expect(review.trend.truncated).toBe(true);
  expect(review.latest?.id).toBe(review.trend.entries[0]?.id);
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page: Response = await a
      .read("weight-entries?limit=100" + (cursor ? "&cursor=" + cursor : ""))
      .expect(200);
    for (const entry of page.body.items) seen.add(entry.id);
    cursor = page.body.nextCursor;
  } while (cursor);
  expect(seen.size).toBe(201);
});

it("keeps daily, meal and entry nutrition consistent across a short local day", async () => {
  const a = await member();
  await a
    .write("put", "preferences", {
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    })
    .expect(200);
  const food = await a.write("post", "foods", foodInput).expect(201);
  const range = dayRange("2026-03-08", "America/Edmonton");
  expect(Date.parse(range.endsAt) - Date.parse(range.startsAt)).toBe(
    23 * 3600000,
  );
  for (const [consumedAt, quantity, mealType] of [
    [new Date(Date.parse(range.startsAt) - 1).toISOString(), 10, "other"],
    [range.startsAt, 0.5, "breakfast"],
    [new Date(Date.parse(range.endsAt) - 1).toISOString(), 2, "dinner"],
    [range.endsAt, 20, "other"],
  ] as const)
    await a
      .write("post", "food-entries", {
        foodId: food.body.id,
        consumedAt,
        quantity,
        mealType,
      })
      .expect(201);
  const result = nutritionDailySchema.parse(
    (await a.read("nutrition/daily?date=2026-03-08").expect(200)).body,
  );
  expect(result.count).toBe(2);
  expect(result.totals.calories.value).toBe(375);
  expect(result.totals.proteinG.value).toBe(12.5);
  expect(result.totals.fatG).toEqual({ value: 0, unknownCount: 0 });
  expect(result.totals.carbsG).toEqual({ value: null, unknownCount: 2 });
  expect(
    result.meals.find((m) => m.mealType === "breakfast")?.totals.calories.value,
  ).toBe(75);
  expect(
    result.meals.find((m) => m.mealType === "lunch")?.totals.calories.value,
  ).toBeNull();
  expect(result.entries.map((e) => e.nutrition.calories.value)).toEqual([
    75, 300,
  ]);
  expect(
    (await a.read("food-entries?date=2026-03-08").expect(200)).body.items,
  ).toHaveLength(2);
});

it("restores foods with revisions and safe retries without rewriting historical snapshots", async () => {
  const a = await member(),
    b = await member();
  const food = (await a.write("post", "foods", foodInput).expect(201)).body;
  const input = {
    foodId: food.id,
    consumedAt: "2026-09-12T12:00:00Z",
    quantity: 1,
    mealType: "lunch",
  };
  const entry = (await a.write("post", "food-entries", input).expect(201)).body;
  const changed = (
    await a
      .write(
        "put",
        "foods/" + food.id,
        { ...foodInput, calories: 400 },
        food.version,
      )
      .expect(200)
  ).body;
  const archived = (
    await a
      .write("post", "foods/" + food.id + "/archive", {}, changed.version)
      .expect(200)
  ).body;
  await a.write("post", "food-entries", input).expect(422);
  const restore = "foods/" + food.id + "/restore";
  await b.write("post", restore, {}, archived.version).expect(404);
  await a.write("post", restore, {}, food.version).expect(409);
  const key = randomUUID();
  const restored = (
    await a.write("post", restore, {}, archived.version, key).expect(200)
  ).body;
  expect(restored.archivedAt).toBeNull();
  expect(
    (await a.write("post", restore, {}, archived.version, key).expect(200))
      .body,
  ).toEqual(restored);
  expect(
    (await a.write("post", "food-entries", input).expect(201)).body
      .caloriesSnapshot,
  ).toBe(400);
  const repeat = {
    quantity: 2,
    consumedAt: input.consumedAt,
    mealType: "snack",
  };
  await b
    .write("post", "food-entries/" + entry.id + "/repeat", repeat)
    .expect(404);
  expect(
    (
      await a
        .write("post", "food-entries/" + entry.id + "/repeat", repeat)
        .expect(201)
    ).body.caloriesSnapshot,
  ).toBe(150);
  expect(
    (await a.read("food-entries/" + entry.id).expect(200)).body
      .caloriesSnapshot,
  ).toBe(150);
});

// Denver retains the 25-hour fall date used by this boundary regression.
it("reviews water and weight by measurement date, excludes later days, and isolates histories", async () => {
  const a = await member(),
    b = await member();
  await a
    .write("put", "preferences", {
      timezone: "America/Denver",
      weekStartsOn: 1,
      weightUnit: "lb",
      distanceUnit: "km",
    })
    .expect(200);
  const date = "2026-11-01",
    range = dayRange(date, "America/Denver");
  expect(Date.parse(range.endsAt) - Date.parse(range.startsAt)).toBe(
    25 * 3600000,
  );
  const endOfDay = new Date(Date.parse(range.endsAt) - 1).toISOString();
  for (const [measuredAt, weightKg] of [
    [range.endsAt, 90],
    [endOfDay, 72],
    [range.startsAt, 71],
    ["2026-10-01T12:00:00Z", 70],
  ] as const)
    await a
      .write("post", "weight-entries", { weightKg, measuredAt })
      .expect(201);
  for (const consumedAt of [range.startsAt, endOfDay, range.endsAt])
    await a
      .write("post", "water-entries", { amountMl: 250, consumedAt })
      .expect(201);
  const water = waterDailySchema.parse(
    (await a.read("hydration/daily?date=" + date).expect(200)).body,
  );
  expect(water.totalMl).toBe(500);
  expect(water.entries).toHaveLength(2);
  expect(water.entries[0]?.consumedAt).toBe(endOfDay);
  const review = weightReviewSchema.parse(
    (await a.read("body/weight-review?date=" + date).expect(200)).body,
  );
  expect(review.latest?.weightKg).toBe(72);
  expect(review.entries.map((e) => e.weightKg)).toEqual([72, 71]);
  expect(review.trend.entries.map((e) => e.weightKg)).toEqual([72, 71]);
  expect(review.trend.from).toBe("2026-10-03");
  expect(review.trend.truncated).toBe(false);
  const before = (
    await a.read("body/weight-review?date=2026-10-31").expect(200)
  ).body;
  expect(before.latest.weightKg).toBe(70);
  expect(before.entries).toEqual([]);
  expect(before.trend.entries).toEqual([]);
  expect(
    (await a.read("weight-entries?through=" + date).expect(200)).body.items,
  ).toHaveLength(3);
  expect(
    (await a.read("water-entries?through=" + date).expect(200)).body.items,
  ).toHaveLength(2);
  expect(
    (await b.read("body/weight-review?date=" + date).expect(200)).body.latest,
  ).toBeNull();
  expect(
    (await b.read("hydration/daily?date=" + date).expect(200)).body.totalMl,
  ).toBeNull();
  expect(
    (await b.read("weight-entries?through=" + date).expect(200)).body.items,
  ).toEqual([]);
  await a
    .write("post", "water-entries", { amountMl: 1.5, consumedAt: endOfDay })
    .expect(422);
  await a
    .write("post", "weight-entries", { weightKg: 0.5, measuredAt: endOfDay })
    .expect(422);
  await a.read("weight-entries?through=invalid").expect(422);
  await request(app)
    .get("/api/v1/body/weight-review?date=" + date)
    .expect(401);
});
