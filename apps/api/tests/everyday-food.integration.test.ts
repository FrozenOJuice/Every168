import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import {
  foodSchema,
  foodEntrySchema,
  nutritionDailySchema,
} from "@168hours/contracts";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, signUp } = testApp();
async function member() {
  const { cookie } = await signUp();
  return {
    get: (p: string) => request(app).get(`/api/v1/${p}`).set("Cookie", cookie),
    write: (
      p: string,
      data: object = {},
      version = 1,
      method: "post" | "put" | "delete" = "post",
      key = randomUUID(),
    ) =>
      request(app)
        [method](`/api/v1/${p}`)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({ ...commandHeaders(version), "Idempotency-Key": key })
        .send(data),
  };
}
const at = "2026-10-23T12:00:00Z";
const rice = {
  name: "Rice",
  servingAmount: 100,
  servingUnit: "g",
  calories: 100,
  proteinG: 4,
  carbsG: 20,
  fatG: 0,
};
it("makes recipes and saved meals, scales portions and keeps historical snapshots through definition changes, archive and repeat", async () => {
  const a = await member();
  const f = foodSchema.parse((await a.write("foods", rice).expect(201)).body);
  const recipeInput = {
    name: "Rice pot",
    kind: "recipe",
    ingredients: [{ foodId: f.id, quantity: 4 }],
    yieldServings: 2,
    instructions: "Cook until ready.",
  };
  const r = foodSchema.parse(
    (await a.write("food-preparations", recipeInput).expect(201)).body,
  );
  expect(r).toMatchObject({
    kind: "recipe",
    calories: 200,
    proteinG: 8,
    carbsG: 40,
    fatG: 0,
    fiberG: null,
    yieldServings: 2,
  });
  const m = foodSchema.parse(
    (
      await a
        .write("food-preparations", {
          name: "Rice lunch",
          kind: "meal",
          ingredients: [
            { foodId: r.id, quantity: 1.5 },
            { foodId: f.id, quantity: 1 },
          ],
        })
        .expect(201)
    ).body,
  );
  expect(m.calories).toBe(400);
  const key = randomUUID(),
    input = {
      foodId: m.id,
      foodVersion: m.version,
      quantity: 0.5,
      consumedAt: at,
      mealType: "lunch",
      ingredientQuantities: [2, 1],
    };
  const e = foodEntrySchema.parse(
    (await a.write("food-entries", input, 1, "post", key).expect(201)).body,
  );
  expect(
    (await a.write("food-entries", input, 1, "post", key).expect(201)).body.id,
  ).toBe(e.id);
  expect(e).toMatchObject({
    caloriesSnapshot: 500,
    quantity: 0.5,
    kindSnapshot: "meal",
  });
  expect((await a.get(`foods/${m.id}`)).body.ingredients[0].quantity).toBe(1.5);
  const f2 = (
    await a
      .write(`foods/${f.id}`, { ...rice, calories: 150 }, f.version, "put")
      .expect(200)
  ).body;
  const r2 = foodSchema.parse(
    (
      await a
        .write(`food-preparations/${r.id}`, recipeInput, r.version, "put")
        .expect(200)
    ).body,
  );
  expect(r2.calories).toBe(300);
  expect((await a.get(`food-entries/${e.id}`)).body.caloriesSnapshot).toBe(500);
  await a.write(`foods/${m.id}/archive`, {}, m.version).expect(200);
  await a.write("food-entries", input).expect(422);
  const repeat = foodEntrySchema.parse(
    (
      await a
        .write(`food-entries/${e.id}/repeat`, { quantity: 2, consumedAt: at })
        .expect(201)
    ).body,
  );
  expect(repeat).toMatchObject({
    caloriesSnapshot: 500,
    ingredientsSnapshot: e.ingredientsSnapshot,
    quantity: 2,
  });
  const daily = nutritionDailySchema.parse(
    (await a.get("nutrition/daily?date=2026-10-23")).body,
  );
  expect(daily.totals.calories.value).toBe(1250);
  expect(daily.totals.fatG.value).toBe(0);
  expect(daily.totals.fiberG).toEqual({ value: null, unknownCount: 2 });
  await a.write(`foods/${f.id}/archive`, {}, f2.version).expect(200);
  await a
    .write(`food-preparations/${r.id}`, recipeInput, r2.version, "put")
    .expect(422);
  await a
    .write("food-entries", { foodId: r.id, quantity: 1, consumedAt: at })
    .expect(201);
});
it("allows nutrition-free quick entries without adding library foods and never interprets unknown ingredients as zero", async () => {
  const a = await member();
  const known = (await a.write("foods", rice).expect(201)).body;
  const unknown = (
    await a
      .write("foods", {
        name: "Unmeasured sauce",
        servingAmount: 1,
        servingUnit: "serving",
      })
      .expect(201)
  ).body;
  const recipe = foodSchema.parse(
    (
      await a
        .write("food-preparations", {
          name: "Mixed bowl",
          kind: "recipe",
          ingredients: [
            { foodId: known.id, quantity: 2 },
            { foodId: unknown.id, quantity: 1 },
          ],
          yieldServings: 2,
        })
        .expect(201)
    ).body,
  );
  expect(recipe.calories).toBeNull();
  expect(recipe.proteinG).toBeNull();
  const input = {
    food: {
      name: "Restaurant dinner",
      servingAmount: 1,
      servingUnit: "serving",
    },
    quantity: 1,
    consumedAt: at,
  };
  const key = randomUUID();
  const q = (
    await a.write("food-entries/quick", input, 1, "post", key).expect(201)
  ).body;
  expect(
    (await a.write("food-entries/quick", input, 1, "post", key)).body.id,
  ).toBe(q.id);
  expect(q).toMatchObject({ foodId: null, caloriesSnapshot: null });
  expect((await a.get("foods?search=Restaurant")).body.items).toEqual([]);
  await a
    .write("food-entries", { foodId: known.id, quantity: 0.5, consumedAt: at })
    .expect(201);
  const daily = nutritionDailySchema.parse(
    (await a.get("nutrition/daily?date=2026-10-23")).body,
  );
  expect(daily.totals.calories).toEqual({ value: 50, unknownCount: 1 });
  await a
    .write(
      `food-entries/${q.id}`,
      { quantity: 2, consumedAt: "2026-10-24T12:00:00Z" },
      q.version,
      "put",
    )
    .expect(200);
  expect((await a.get("nutrition/daily?date=2026-10-23")).body.count).toBe(1);
});
it("isolates preparation references and actions, validates recipe structure and refuses stale definition writes", async () => {
  const a = await member(),
    b = await member();
  const f = (await a.write("foods", rice)).body;
  const input = {
    name: "Owned recipe",
    kind: "recipe",
    ingredients: [{ foodId: f.id, quantity: 1 }],
    yieldServings: 1,
  };
  await b.write("food-preparations", input).expect(404);
  const r = (await a.write("food-preparations", input).expect(201)).body;
  await b.get(`foods/${r.id}`).expect(404);
  await b
    .write(`foods/${r.id}/favourite`, { favourite: true }, r.version)
    .expect(404);
  await b
    .write("food-entries", { foodId: r.id, quantity: 1, consumedAt: at })
    .expect(404);
  await b
    .write(`food-preparations/${r.id}`, input, r.version, "put")
    .expect(404);
  await a.write(`foods/${r.id}`, rice, r.version, "put").expect(422);
  await a
    .write(
      `food-preparations/${r.id}`,
      { ...input, ingredients: [{ foodId: r.id, quantity: 1 }] },
      r.version,
      "put",
    )
    .expect(422);
  await a
    .write("food-preparations", {
      ...input,
      ingredients: [{ foodId: r.id, quantity: 1 }],
    })
    .expect(422);
  for (const invalid of [
    { ...input, yieldServings: 0 },
    { ...input, ingredients: [] },
    { ...input, kind: "meal", yieldServings: 2 },
    { ...input, ingredients: [{ foodId: f.id, quantity: -1 }] },
  ])
    await a.write("food-preparations", invalid).expect(422);
  await a
    .write("food-entries", {
      foodId: r.id,
      quantity: 1,
      consumedAt: at,
      ingredientQuantities: [1, 2],
    })
    .expect(422);
  const responses = await Promise.all([
    a.write(
      `food-preparations/${r.id}`,
      { ...input, name: "Edit one" },
      r.version,
      "put",
    ),
    a.write(
      `food-preparations/${r.id}`,
      { ...input, name: "Edit two" },
      r.version,
      "put",
    ),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  await a
    .write("food-entries", {
      foodId: r.id,
      foodVersion: r.version,
      quantity: 1,
      consumedAt: at,
      ingredientQuantities: [1],
    })
    .expect(409);
  await a
    .write("food-entries", {
      foodId: r.id,
      quantity: 1,
      consumedAt: at,
      ingredientQuantities: [1],
    })
    .expect(422);
});
it("filters favourites and kinds privately and keeps a logged meal as one Calendar moment", async () => {
  const a = await member(),
    b = await member();
  const f = (await a.write("foods", { ...rice, favourite: true })).body;
  const m = (
    await a.write("food-preparations", {
      name: "Favourite meal",
      kind: "meal",
      favourite: true,
      ingredients: [{ foodId: f.id, quantity: 1 }],
    })
  ).body;
  expect(
    (await a.get("foods?kind=meal&favourite=true")).body.items.map(
      (i: { id: string }) => i.id,
    ),
  ).toEqual([m.id]);
  expect((await b.get("foods?kind=meal&favourite=true")).body.items).toEqual(
    [],
  );
  await a
    .write(`foods/${m.id}/favourite`, { favourite: false }, m.version)
    .expect(200);
  expect((await a.get("foods?kind=meal&favourite=true")).body.items).toEqual(
    [],
  );
  await a
    .write("food-entries", { foodId: m.id, quantity: 1, consumedAt: at })
    .expect(201);
  const daily = nutritionDailySchema.parse(
    (await a.get("nutrition/daily?date=2026-10-23")).body,
  );
  expect(daily.count).toBe(1);
  const activity = (
    await a.get("calendar/activity?from=2026-10-23&to=2026-10-23").expect(200)
  ).body;
  const moments = activity.entries.filter(
    (e: { source: { type: string } }) => e.source.type === "food_entry",
  );
  expect(moments).toHaveLength(1);
  expect(moments[0]).toMatchObject({
    kind: "moment",
    endsAt: null,
    href: "/food?date=2026-10-23",
  });
  expect(daily.entries[0]!.ingredientsSnapshot).toHaveLength(1);
  await request(app).get("/api/v1/foods").expect(401);
});
