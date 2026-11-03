import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import {
  importCnf,
  readCnfDataset,
} from "../src/modules/nutrition/catalogue-import.repository.js";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, deps, signUp } = testApp("preview");
async function member() {
  const { cookie } = await signUp();
  return {
    get: (path: string) =>
      request(app).get(`/api/v1/${path}`).set("Cookie", cookie),
    write: (
      path: string,
      data: object,
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
it("imports the full source atomically in batches, repeats without duplicates and searches through PostgreSQL", async () => {
  const data = await readCnfDataset();
  const first = await importCnf(deps.db, data);
  expect(first.inserted + first.updated + first.unchanged).toBe(5993);
  const second = await importCnf(deps.db, data);
  expect(second).toMatchObject({
    inserted: 0,
    updated: 0,
    unchanged: 5993,
    batches: 0,
  });
  expect(second.portions).toBeGreaterThan(10000);
  expect(second.nutrientValues).toBeGreaterThan(100000);
  const a = await member();
  await request(app).get("/api/v1/food-catalogue?search=chicken").expect(401);
  const firstPage = (
    await a.get("food-catalogue?search=chicken&limit=5").expect(200)
  ).body;
  const next = (
    await a.get("food-catalogue?search=chicken&limit=5&offset=5").expect(200)
  ).body;
  expect(
    new Set([...firstPage.items, ...next.items].map((f) => f.id)).size,
  ).toBe(10);
  expect((await a.get("food-catalogue?search=%25_")).body.total).toBe(0);
  expect((await a.get("food-catalogue?search=deshydrate")).body.total).toBe(
    (await a.get("food-catalogue?search=d%C3%A9shydrat%C3%A9")).body.total,
  );
  await a.get("food-catalogue?limit=1000").expect(422);
});
it("logs catalogue grams/real portions and recipes without creating owned copies; snapshots survive reimport", async () => {
  const data = await readCnfDataset();
  await importCnf(deps.db, data);
  const a = await member(),
    b = await member();
  const food = (
    await a.get("food-catalogue?search=cheese%20souffle")
  ).body.items.find((f: { code: string }) => f.code === "2");
  const key = randomUUID();
  const input = {
    catalogueId: food.id,
    quantity: 50,
    portionId: "g",
    foodVersion: food.version,
    consumedAt: "2026-11-03T12:00:00Z",
  };
  const entry = (
    await a.write("food-entries", input, 1, "post", key).expect(201)
  ).body;
  await a
    .write("food-entries", {
      catalogueId: food.id,
      quantity: 100000,
      consumedAt: "2026-11-03T12:00:00Z",
    })
    .expect(422);
  expect(entry).toMatchObject({
    foodId: null,
    catalogueId: food.id,
    quantity: 0.5,
    caloriesSnapshot: 204,
    sourceSnapshot: { provider: "cnf", release: "2026", code: "2" },
  });
  expect((await a.write("food-entries", input, 1, "post", key)).body.id).toBe(
    entry.id,
  );
  expect((await a.get("foods")).body.items).toHaveLength(0);
  await b.get(`food-entries/${entry.id}`).expect(404);
  const portion = (
    await a
      .write("food-entries", {
        catalogueId: food.id,
        quantity: 1,
        portionId: "341",
        consumedAt: "2026-11-03T13:00:00Z",
      })
      .expect(201)
  ).body;
  expect(portion.quantity).toBeCloseTo(0.40152);
  await a
    .write("food-entries", { ...input, portionId: "not-a-portion" })
    .expect(404);
  const recipe = (
    await a
      .write("food-preparations", {
        name: "Catalogue recipe",
        kind: "recipe",
        ingredients: [{ catalogueId: food.id, quantity: 200, portionId: "g" }],
        yieldServings: 4,
      })
      .expect(201)
  ).body;
  expect(recipe.calories).toBe(102);
  expect(recipe.ingredients[0]).toMatchObject({
    catalogueId: food.id,
    foodId: null,
    quantity: 2,
  });
  const changed = structuredClone(data);
  const row = changed.foods.find((f: { code: string }) => f.code === "2")!;
  row.calories = 100;
  row.nutrients["208"] = 100;
  try {
    expect((await importCnf(deps.db, changed)).updated).toBe(1);
    const repeated = (
      await a
        .write(`food-entries/${entry.id}/repeat`, {
          quantity: 1,
          consumedAt: "2026-11-04T12:00:00Z",
        })
        .expect(201)
    ).body;
    expect(repeated.caloriesSnapshot).toBe(204);
    expect((await a.get(`foods/${recipe.id}`)).body.calories).toBe(102);
    await a
      .write("food-entries", { ...input, consumedAt: "2026-11-04T12:00:00Z" })
      .expect(409);
  } finally {
    await importCnf(deps.db, data);
  }
  await a
    .write(
      `foods/${food.id}`,
      { name: "Shared edit", servingAmount: 100, servingUnit: "g" },
      food.version,
      "put",
    )
    .expect(404);
});
it("isolates optional targets, handles competing first saves and keeps unknown daily nutrition separate from zero", async () => {
  const a = await member(),
    b = await member();
  const goals = (await a.get("nutrition-goals").expect(200)).body;
  expect(goals).toMatchObject({ version: 1, calories: null, proteinG: null });
  const attempts = await Promise.all([
    a.write("nutrition-goals", { calories: 2000 }, 1, "put"),
    a.write("nutrition-goals", { proteinG: 100 }, 1, "put"),
  ]);
  expect(attempts.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await b.get("nutrition-goals")).body).toEqual(goals);
  const saved = (await a.get("nutrition-goals")).body;
  const cleared = (
    await a
      .write(
        "nutrition-goals",
        { calories: null, proteinG: null, carbsG: 250, fatG: null },
        saved.version,
        "put",
      )
      .expect(200)
  ).body;
  expect(cleared).toMatchObject({
    calories: null,
    proteinG: null,
    carbsG: 250,
    fatG: null,
    version: 3,
  });
  await a.write("nutrition-goals", { calories: 0 }, 3, "put").expect(422);
  await a
    .write("food-entries/quick", {
      food: {
        name: "Unknown food",
        servingAmount: 1,
        servingUnit: "serving",
        calories: null,
        fatG: 0,
      },
      quantity: 1,
      consumedAt: "2026-11-03T12:00:00Z",
    })
    .expect(201);
  const daily = (await a.get("nutrition/daily?date=2026-11-03")).body;
  expect(daily.totals.calories).toEqual({ value: null, unknownCount: 1 });
  expect(daily.totals.fatG).toEqual({ value: 0, unknownCount: 0 });
});
