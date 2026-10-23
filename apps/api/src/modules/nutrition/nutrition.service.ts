import {
  CALENDAR_ACTIVITY_LIMIT,
  foodInput,
  preparationInput,
  type PreparationInput,
  type QuickFoodInput,
  type IngredientSnapshot,
  type CalendarContribution,
} from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
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
import { assertRevision } from "../../shared/errors/revision.js";
import { found, AppError } from "../../shared/errors/app-error.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { nutritionRepository } from "./nutrition.repository.js";
import {
  nutritionTotals,
  preparationNutrients,
  entryDetail,
  mealSummaries,
} from "./nutrition.calculations.js";
export function nutritionService(
  repo: ReturnType<typeof nutritionRepository>,
  identity: IdentityService,
  runInTransaction: RunInTransaction,
) {
  const snapshot = (food: {
    name: string;
    servingAmount: number;
    servingUnit: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    fiberG: number | null;
  }) => ({
    nameSnapshot: food.name,
    servingAmountSnapshot: food.servingAmount,
    servingUnitSnapshot: food.servingUnit,
    caloriesSnapshot: food.calories,
    proteinGSnapshot: food.proteinG,
    carbsGSnapshot: food.carbsG,
    fatGSnapshot: food.fatG,
    fiberGSnapshot: food.fiberG,
  });
  async function prepare(
    u: string,
    input: PreparationInput,
    context: TransactionContext,
    ownId?: string,
  ) {
    const v = preparationInput.parse(input);
    const definitions = new Map<
      string,
      Awaited<ReturnType<typeof repo.getFood>>
    >();
    for (const id of [...new Set(v.ingredients.map((i) => i.foodId))].sort()) {
      if (id === ownId)
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "A preparation cannot include itself.",
        );
      const food = found(await repo.getFood(u, id, context));
      if (
        food.archivedAt ||
        food.kind === "meal" ||
        (v.kind === "recipe" && food.kind !== "food")
      )
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Recipes use active foods. Saved meals can use active foods and recipes.",
        );
      definitions.set(id, food);
    }
    const ingredients: IngredientSnapshot[] = v.ingredients.map((i) => {
      const f = found(definitions.get(i.foodId));
      return {
        ...foodInput.omit({ favourite: true }).parse({
          name: f.name,
          servingAmount: f.servingAmount,
          servingUnit: f.servingUnit,
          calories: f.calories,
          proteinG: f.proteinG,
          carbsG: f.carbsG,
          fatG: f.fatG,
          fiberG: f.fiberG,
        }),
        ...i,
      };
    });
    return {
      ...foodInput.parse({
        name: v.name,
        servingAmount: 1,
        servingUnit: "serving",
        favourite: v.favourite,
        ...preparationNutrients(ingredients, v.yieldServings),
      }),
      kind: v.kind,
      ingredients,
      yieldServings: v.yieldServings,
      instructions: v.instructions,
    };
  }
  return {
    async calendarActivity(
      u: string,
      range: {
        startsAt: string;
        endsAt: string;
        timezone: string;
        weightUnit: "kg" | "lb";
      },
    ): Promise<CalendarContribution> {
      const rows = await repo.activityRange(u, range.startsAt, range.endsAt);
      return {
        label: "Food",
        href: "/food",
        truncated: rows.length > CALENDAR_ACTIVITY_LIMIT,
        entries: rows.slice(0, CALENDAR_ACTIVITY_LIMIT).map((row) => ({
          source: { type: "food_entry", id: row.id },
          domain: "Food",
          icon: "utensils",
          kind: "moment",
          status: "recorded",
          title: row.nameSnapshot,
          summary: `${row.quantity} × ${row.servingAmountSnapshot} ${row.servingUnitSnapshot} · ${row.mealType}`,
          occurredAt: row.consumedAt.toISOString(),
          endsAt: null,
          href: `/food?date=${localDate(row.consumedAt, range.timezone)}`,
        })),
      };
    },
    platformUsage: repo.platformUsage,
    listFoods: repo.listFoods,
    async getFood(u: string, id: string) {
      return found(await repo.getFood(u, id));
    },
    createFood: (u: string, v: FoodInput, context?: TransactionContext) =>
      repo.createFood(u, foodInput.parse(v), context),
    async savePreparation(
      u: string,
      input: PreparationInput,
      id?: string,
      version?: number,
      context?: TransactionContext,
    ) {
      return runInTransaction(async (scope) => {
        if (id) {
          const previous = found(await repo.getFood(u, id));
          if (previous.kind !== input.kind)
            throw new AppError(
              422,
              "BUSINESS_RULE",
              "Keep the original preparation type.",
            );
        }
        const v = await prepare(u, input, scope, id);
        return id
          ? found(await repo.updateFood(u, id, v, version!, scope))
          : repo.createFood(u, v, scope);
      }, context);
    },
    async favourite(
      u: string,
      id: string,
      favourite: boolean,
      version: number,
      context?: TransactionContext,
    ) {
      return found(
        await repo.updateFood(u, id, { favourite }, version, context),
      );
    },
    async quickLog(u: string, v: QuickFoodInput, context?: TransactionContext) {
      return repo.createEntry(
        u,
        {
          ...snapshot(v.food),
          consumedAt: new Date(v.consumedAt),
          quantity: v.quantity,
          mealType: v.mealType,
        },
        context,
      );
    },
    async updateFood(
      u: string,
      id: string,
      v: FoodInput,
      version: number,
      context?: TransactionContext,
    ) {
      const previous = found(await repo.getFood(u, id));
      if (previous.kind !== "food")
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Edit the ingredients of this saved meal or recipe instead.",
        );
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
        if (
          v.ingredientQuantities &&
          (food.kind === "food" ||
            v.ingredientQuantities.length !== food.ingredients.length)
        )
          throw new AppError(
            422,
            "BUSINESS_RULE",
            "Provide one quantity for each ingredient.",
          );
        if (v.foodVersion !== undefined) assertRevision(food, v.foodVersion);
        const ingredients = food.ingredients.map((i, index) => ({
          ...i,
          quantity: v.ingredientQuantities?.[index] ?? i.quantity,
        }));
        const nutrients = v.ingredientQuantities
          ? preparationNutrients(ingredients, food.yieldServings)
          : food;
        // Bound adjusted nutrition with the same public food rules.
        const adjusted = foodInput.parse({
          name: food.name,
          servingAmount: food.servingAmount,
          servingUnit: food.servingUnit,
          calories: nutrients.calories,
          proteinG: nutrients.proteinG,
          carbsG: nutrients.carbsG,
          fatG: nutrients.fatG,
          fiberG: nutrients.fiberG,
        });
        return repo.createEntry(
          u,
          {
            ...snapshot(adjusted),
            foodId: food.id,
            consumedAt: new Date(v.consumedAt),
            quantity: v.quantity,
            mealType: v.mealType,
            kindSnapshot: food.kind,
            ingredientsSnapshot: ingredients,
            yieldServingsSnapshot: food.yieldServings,
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
          kindSnapshot: e.kindSnapshot,
          ingredientsSnapshot: e.ingredientsSnapshot,
          yieldServingsSnapshot: e.yieldServingsSnapshot,
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
