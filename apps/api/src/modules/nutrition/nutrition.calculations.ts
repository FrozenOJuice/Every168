import { AppError, found } from "../../shared/errors/app-error.js";
import type { NutritionTotals } from "@168hours/contracts";
import { mealType } from "@168hours/contracts";
type Snapshot = {
  quantity: number;
  caloriesSnapshot: number | null;
  proteinGSnapshot: number | null;
  carbsGSnapshot: number | null;
  fatGSnapshot: number | null;
  fiberGSnapshot: number | null;
};
export function nutritionTotals(entries: Snapshot[]): NutritionTotals {
  function total(key: Exclude<keyof Snapshot, "quantity">) {
    const known = entries.filter((e) => e[key] !== null);
    return {
      value: known.length
        ? known.reduce((n, e) => n + e[key]! * e.quantity, 0)
        : null,
      unknownCount: entries.length - known.length,
    };
  }
  return {
    calories: total("caloriesSnapshot"),
    proteinG: total("proteinGSnapshot"),
    carbsG: total("carbsGSnapshot"),
    fatG: total("fatGSnapshot"),
    fiberG: total("fiberGSnapshot"),
  };
}
export function entryDetail<T extends Snapshot>(entry: T) {
  return { ...entry, nutrition: nutritionTotals([entry]) };
}
export function mealSummaries(entries: (Snapshot & { mealType: string })[]) {
  return mealType.options.map((meal) => {
    const items = entries.filter((entry) => entry.mealType === meal);
    return {
      mealType: meal,
      count: items.length,
      totals: nutritionTotals(items),
    };
  });
}

/** Unknown ingredients make that nutrient unknown for the preparation, never understated. */
export function preparationNutrients(
  ingredients: import("@168hours/contracts").IngredientSnapshot[],
  yieldServings: number,
) {
  const total = (
    key: "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG",
  ) =>
    ingredients.some((i) => i[key] === null)
      ? null
      : ingredients.reduce((sum, i) => sum + i[key]! * i.quantity, 0) /
        yieldServings;
  return {
    calories: total("calories"),
    proteinG: total("proteinG"),
    carbsG: total("carbsG"),
    fatG: total("fatG"),
    fiberG: total("fiberG"),
  };
}

/** Convert only documented gram weights; the result is a multiplier of the captured basis. */
export function catalogueQuantity(
  amount: number,
  portionId: string | undefined,
  food: Pick<
    import("@168hours/contracts").CatalogueFood,
    "servingAmount" | "servingUnit" | "portions"
  >,
) {
  let result = amount;
  if (portionId) {
    if (food.servingUnit !== "g")
      throw new AppError(
        422,
        "BUSINESS_RULE",
        "This food does not support gram portions.",
      );
    const grams =
      portionId === "g"
        ? 1
        : found(food.portions.find((p) => p.id === portionId)).grams;
    result = (amount * grams) / food.servingAmount;
  }
  if (!Number.isFinite(result) || result <= 0 || result > 1000)
    throw new AppError(
      422,
      "BUSINESS_RULE",
      "Choose an amount up to 1,000 reference servings.",
    );
  return result;
}
