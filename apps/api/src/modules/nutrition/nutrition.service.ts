import type {
  FoodInput,
  FoodEntryInput,
  FoodEntryUpdate,
} from "@168hours/contracts";
import { dayRange } from "@168hours/domain-utils";
import { found, AppError } from "../../shared/errors/app-error.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { nutritionRepository } from "./nutrition.repository.js";
import { nutritionTotals } from "./nutrition.calculations.js";
export function nutritionService(
  repo: ReturnType<typeof nutritionRepository>,
  identity: IdentityService,
) {
  return {
    listFoods: repo.listFoods,
    async getFood(u: string, id: string) {
      return found(await repo.getFood(u, id));
    },
    createFood: repo.createFood,
    async updateFood(u: string, id: string, v: FoodInput) {
      return found(await repo.updateFood(u, id, v));
    },
    async archiveFood(u: string, id: string) {
      return found(await repo.updateFood(u, id, { archivedAt: new Date() }));
    },
    async getEntry(u: string, id: string) {
      return found(await repo.getEntry(u, id));
    },
    async logFood(u: string, v: FoodEntryInput) {
      const food = found(await repo.getFood(u, v.foodId));
      if (food.archivedAt)
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "This food is archived. Choose an active food.",
        );
      return repo.createEntry(u, {
        foodId: food.id,
        consumedAt: new Date(v.consumedAt),
        quantity: v.quantity,
        mealType: v.mealType,
        nameSnapshot: food.name,
        servingAmountSnapshot: food.servingAmount,
        servingUnitSnapshot: food.servingUnit,
        caloriesSnapshot: food.calories,
        proteinGSnapshot: food.proteinG,
        carbsGSnapshot: food.carbsG,
        fatGSnapshot: food.fatG,
        fiberGSnapshot: food.fiberG,
      });
    },
    async repeatEntry(u: string, id: string, v: FoodEntryUpdate) {
      const e = found(await repo.getEntry(u, id));
      return repo.createEntry(u, {
        foodId: e.foodId,
        consumedAt: new Date(v.consumedAt),
        quantity: v.quantity,
        mealType: v.mealType,
        nameSnapshot: e.nameSnapshot,
        servingAmountSnapshot: e.servingAmountSnapshot,
        servingUnitSnapshot: e.servingUnitSnapshot,
        caloriesSnapshot: e.caloriesSnapshot,
        proteinGSnapshot: e.proteinGSnapshot,
        carbsGSnapshot: e.carbsGSnapshot,
        fatGSnapshot: e.fatGSnapshot,
        fiberGSnapshot: e.fiberGSnapshot,
      });
    },
    async updateEntry(u: string, id: string, v: FoodEntryUpdate) {
      return found(await repo.updateEntry(u, id, v));
    },
    async deleteEntry(u: string, id: string) {
      found(await repo.deleteEntry(u, id));
      return { ok: true as const };
    },
    async daily(u: string, date: string) {
      const prefs = await identity.getPreferences(u);
      const range = dayRange(date, prefs.timezone);
      const entries = await repo.entriesInRange(
        u,
        range.startsAt,
        range.endsAt,
      );
      return {
        date,
        count: entries.length,
        totals: nutritionTotals(entries),
        entries,
      };
    },
  };
}
export type NutritionService = ReturnType<typeof nutritionService>;
