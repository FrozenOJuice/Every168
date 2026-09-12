import type { NutritionTotals } from "@168hours/contracts";
type Snapshot = {
  quantity: number;
  caloriesSnapshot: number;
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
