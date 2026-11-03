import { expect, it } from "vitest";
import { readCnfDataset } from "./catalogue-import.repository.js";
import { catalogueQuantity } from "./nutrition.calculations.js";
import { normalizeFoodSearch } from "./catalogue.repository.js";
import {
  foodEntryInput,
  ingredientInput,
  nutritionGoalsInput,
} from "@168hours/contracts";
it("validates the actual enriched CNF dataset, source units, portions and unknown nutrients", async () => {
  const data = await readCnfDataset();
  expect(data.foods).toHaveLength(5993);
  expect(Object.keys(data.nutrientDefinitions)).toHaveLength(173);
  expect(data.basis).toEqual({ amount: 100, unit: "g" });
  expect(data.foods.find((f) => f.code === "2")).toMatchObject({
    calories: 204,
    proteinG: 9.54415,
    portions: [
      { id: "341", label: "100 ml", grams: 40.152 },
      { id: "383", label: "125 ml", grams: 50.19 },
      { id: "415", label: "250 ml", grams: 100.38 },
    ],
  });
  expect(data.foods.find((f) => f.code === "970")?.fiberG).toBeNull();
  expect(data.foods.some((f) => f.fatG === 0)).toBe(true);
  expect(data.foods.every((f) => f.portions.every((p) => p.grams > 0))).toBe(
    true,
  );
});
it("keeps reference types exclusive and goals independently optional", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  expect(
    ingredientInput.safeParse({ foodId: id, catalogueId: id, quantity: 1 })
      .success,
  ).toBe(false);
  expect(
    foodEntryInput.safeParse({
      catalogueId: id,
      quantity: 50,
      portionId: "g",
      consumedAt: "2026-11-03T12:00:00Z",
    }).success,
  ).toBe(true);
  expect(nutritionGoalsInput.parse({ calories: 2000 })).toEqual({
    calories: 2000,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  expect(nutritionGoalsInput.safeParse({ proteinG: 0 }).success).toBe(false);
  expect(normalizeFoodSearch("DÉSHYDRATÉ")).toBe("deshydrate");
});

it("scales grams and actual source portions, rejecting unknown portions and oversized basis quantities", () => {
  const food = {
    servingAmount: 100,
    servingUnit: "g" as const,
    portions: [{ id: "cup", label: "Cup", grams: 40.152 }],
  };
  expect(catalogueQuantity(50, "g", food)).toBe(0.5);
  expect(catalogueQuantity(1, "cup", food)).toBeCloseTo(0.40152);
  expect(catalogueQuantity(0.001, "g", food)).toBeCloseTo(0.00001);
  expect(() => catalogueQuantity(100000, undefined, food)).toThrow();
  expect(() => catalogueQuantity(1, "missing", food)).toThrow();
  expect(() =>
    catalogueQuantity(1, "g", { ...food, servingUnit: "ml" }),
  ).toThrow();
});
