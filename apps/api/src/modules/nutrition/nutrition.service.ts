import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import type {
  FoodInput,
  FoodEntryInput,
  FoodEntryUpdate,
  FoodHistoryQuery,
} from "@168hours/contracts";
import { dayRange } from "@168hours/domain-utils";
import { found, AppError } from "../../shared/errors/app-error.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { nutritionRepository } from "./nutrition.repository.js";
import {
  nutritionTotals,
  entryDetail,
  mealSummaries,
} from "./nutrition.calculations.js";
export function nutritionService(
  repo: ReturnType<typeof nutritionRepository>,
  identity: IdentityService,
  runInTransaction: RunInTransaction,
) {
  return {
    listFoods: repo.listFoods,
    async getFood(u: string, id: string) {
      return found(await repo.getFood(u, id));
    },
    createFood: repo.createFood,
    async updateFood(
      u: string,
      id: string,
      v: FoodInput,
      version: number,
      context?: TransactionContext,
    ) {
      return found(await repo.updateFood(u, id, v, version, context));
    },
    async archiveFood(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      return found(
        await repo.updateFood(
          u,
          id,
          { archivedAt: new Date() },
          version,
          context,
        ),
      );
    },
    async getEntry(u: string, id: string) {
      return found(await repo.getEntry(u, id));
    },
    async restoreFood(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      return found(
        await repo.updateFood(u, id, { archivedAt: null }, version, context),
      );
    },
    async history(u: string, q: FoodHistoryQuery) {
      const range = q.date
        ? dayRange(q.date, (await identity.getPreferences(u)).timezone)
        : undefined;
      const result = await repo.listEntries(u, q, range);
      return { ...result, items: result.items.map(entryDetail) };
    },
    async logFood(u: string, v: FoodEntryInput, context?: TransactionContext) {
      return runInTransaction(async (scope) => {
        const food = found(await repo.getFood(u, v.foodId, scope));
        if (food.archivedAt)
          throw new AppError(
            422,
            "BUSINESS_RULE",
            "This food is archived. Choose an active food.",
          );
        return repo.createEntry(
          u,
          {
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
          },
          scope,
        );
      }, context);
    },
    async repeatEntry(
      u: string,
      id: string,
      v: FoodEntryUpdate,
      context?: TransactionContext,
    ) {
      const e = found(await repo.getEntry(u, id, context));
      return repo.createEntry(
        u,
        {
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
        },
        context,
      );
    },
    async updateEntry(
      u: string,
      id: string,
      v: FoodEntryUpdate,
      version: number,
      context?: TransactionContext,
    ) {
      return found(await repo.updateEntry(u, id, v, version, context));
    },
    async deleteEntry(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      found(await repo.deleteEntry(u, id, version, context));
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
        entries: entries.map(entryDetail),
        meals: mealSummaries(entries),
      };
    },
  };
}
export type NutritionService = ReturnType<typeof nutritionService>;
