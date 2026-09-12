import { it, expect } from "vitest";
import { nutritionTotals } from "./nutrition.calculations.js";
it("multiplies known snapshot nutrients and preserves missing values", () => {
  const item = {
    quantity: 2,
    caloriesSnapshot: 120,
    proteinGSnapshot: 10,
    carbsGSnapshot: null,
    fatGSnapshot: 0,
    fiberGSnapshot: null,
  };
  const totals = nutritionTotals([
    item,
    { ...item, quantity: 1, proteinGSnapshot: null },
  ]);
  expect(totals.calories.value).toBe(360);
  expect(totals.proteinG).toEqual({ value: 20, unknownCount: 1 });
  expect(totals.carbsG).toEqual({ value: null, unknownCount: 2 });
  expect(totals.fatG).toEqual({ value: 0, unknownCount: 0 });
  expect(nutritionTotals([]).calories.value).toBeNull();
});
