import type {
  Food,
  FoodInput,
  FoodEntry,
  FoodEntryInput,
  FoodEntryUpdate,
  NutritionDaily,
  LibraryQuery,
  Page,
  FoodEntryDetail,
  FoodHistoryQuery,
} from "@168hours/contracts";
import { writeHeaders, body, query, type Http } from "./http";
export function nutritionClient(http: Http) {
  return {
    getFoodHistory: (q: Partial<FoodHistoryQuery> = {}) =>
      http<Page<FoodEntryDetail>>("/api/v1/food-entries" + query(q)),
    restoreFood: (id: string, version: number, key?: string) =>
      http<Food>("/api/v1/foods/" + id + "/restore", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    getFoods: (q: Partial<LibraryQuery> = {}) =>
      http<Page<Food>>("/api/v1/foods" + query(q)),
    createFood: (v: FoodInput, key?: string) =>
      http<Food>("/api/v1/foods", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateFood: (id: string, v: FoodInput, version: number, key?: string) =>
      http<Food>("/api/v1/foods/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    archiveFood: (id: string, version: number, key?: string) =>
      http<Food>("/api/v1/foods/" + id + "/archive", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    logFood: (v: FoodEntryInput, key?: string) =>
      http<FoodEntry>("/api/v1/food-entries", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateFoodEntry: (
      id: string,
      v: FoodEntryUpdate,
      version: number,
      key?: string,
    ) =>
      http<FoodEntry>("/api/v1/food-entries/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    repeatFoodEntry: (id: string, v: FoodEntryUpdate, key?: string) =>
      http<FoodEntry>("/api/v1/food-entries/" + id + "/repeat", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    deleteFoodEntry: (id: string, version: number, key?: string) =>
      http<{ ok: true }>("/api/v1/food-entries/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    getNutritionDaily: (date: string) =>
      http<NutritionDaily>("/api/v1/nutrition/daily" + query({ date })),
  };
}
