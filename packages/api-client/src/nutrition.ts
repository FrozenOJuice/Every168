import type {
  Food,
  FoodInput,
  FoodEntry,
  FoodEntryInput,
  FoodEntryUpdate,
  NutritionDaily,
  LibraryQuery,
  Page,
} from "@168hours/contracts";
import { body, query, type Http } from "./http";
export function nutritionClient(http: Http) {
  return {
    getFoods: (q: Partial<LibraryQuery> = {}) =>
      http<Page<Food>>("/api/v1/foods" + query(q)),
    createFood: (v: FoodInput) =>
      http<Food>("/api/v1/foods", { method: "POST", body: body(v) }),
    updateFood: (id: string, v: FoodInput) =>
      http<Food>("/api/v1/foods/" + id, { method: "PUT", body: body(v) }),
    archiveFood: (id: string) =>
      http<Food>("/api/v1/foods/" + id + "/archive", {
        method: "POST",
        body: "{}",
      }),
    logFood: (v: FoodEntryInput) =>
      http<FoodEntry>("/api/v1/food-entries", {
        method: "POST",
        body: body(v),
      }),
    updateFoodEntry: (id: string, v: FoodEntryUpdate) =>
      http<FoodEntry>("/api/v1/food-entries/" + id, {
        method: "PUT",
        body: body(v),
      }),
    repeatFoodEntry: (id: string, v: FoodEntryUpdate) =>
      http<FoodEntry>("/api/v1/food-entries/" + id + "/repeat", {
        method: "POST",
        body: body(v),
      }),
    deleteFoodEntry: (id: string) =>
      http<{ ok: true }>("/api/v1/food-entries/" + id, { method: "DELETE" }),
    getNutritionDaily: (date: string) =>
      http<NutritionDaily>("/api/v1/nutrition/daily" + query({ date })),
  };
}
