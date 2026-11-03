import {
  CALENDAR_ACTIVITY_LIMIT,
  type CatalogueFood,
  type NutritionGoalsInput,
  type IngredientSnapshot,
  type CatalogueQuery,
  type FoodSource,
  foodInput,
  preparationInput,
  type PreparationInput,
  type QuickFoodInput,
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
  catalogueQuantity,
  nutritionTotals,
  preparationNutrients,
  entryDetail,
  mealSummaries,
} from "./nutrition.calculations.js";
import type { catalogueRepository } from "./catalogue.repository.js";
export function nutritionService(
  repo: ReturnType<typeof nutritionRepository>,
  identity: IdentityService,
  runInTransaction: RunInTransaction,
  catalogue: ReturnType<typeof catalogueRepository>,
) {
  const snapshot = (food: {
    source?: FoodSource | null;
    name: string;
    servingAmount: number;
    servingUnit: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    fiberG: number | null;
  }) => ({
    sourceSnapshot: food.source ?? null,
    nameSnapshot: food.name,
    servingAmountSnapshot: food.servingAmount,
    servingUnitSnapshot: food.servingUnit,
    caloriesSnapshot: food.calories,
    proteinGSnapshot: food.proteinG,
    carbsGSnapshot: food.carbsG,
    fatGSnapshot: food.fatG,
    fiberGSnapshot: food.fiberG,
  });
  async function resolve(
    u: string,
    ref: { foodId?: string; catalogueId?: string },
    context?: TransactionContext,
  ) {
    if (ref.catalogueId) {
      const f = found(await catalogue.get(ref.catalogueId, context));
      return {
        ...f,
        foodId: null,
        catalogueId: f.id,
        servingAmount: f.basisAmount,
        servingUnit: f.basisUnit as "g" | "ml",
        kind: "food" as const,
        ingredients: [] as IngredientSnapshot[],
        yieldServings: 1,
        archivedAt: null,
        source: {
          provider: f.provider,
          release: f.release,
          code: f.code,
          name: f.name,
          modified: false,
        },
      };
    }
    const f = found(await repo.getFood(u, ref.foodId!, context));
    return { ...f, foodId: f.id, catalogueId: null };
  }
  function quantity(
    v: { quantity: number; portionId?: string; catalogueId?: string },
    f: Awaited<ReturnType<typeof resolve>>,
  ) {
    if (!v.catalogueId) return v.quantity;
    if (!("portions" in f))
      throw new AppError(422, "BUSINESS_RULE", "Choose a catalogue food.");
    return catalogueQuantity(v.quantity, v.portionId, f);
  }
  const referenceKey = (ref: { foodId?: string; catalogueId?: string }) =>
    ref.catalogueId ? `catalogue:${ref.catalogueId}` : `owned:${ref.foodId}`;
  async function prepare(
    u: string,
    input: PreparationInput,
    context: TransactionContext,
    ownId?: string,
  ) {
    const v = preparationInput.parse(input);
    const definitions = new Map<string, Awaited<ReturnType<typeof resolve>>>();
    for (const i of [...v.ingredients].sort((a, b) =>
      (a.foodId ?? a.catalogueId!).localeCompare(b.foodId ?? b.catalogueId!),
    )) {
      if (i.foodId === ownId && ownId)
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "A preparation cannot include itself.",
        );
      const food = await resolve(u, i, context);
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
      definitions.set(referenceKey(i), food);
    }
    const ingredients: IngredientSnapshot[] = v.ingredients.map((i) => {
      const f = found(definitions.get(referenceKey(i)));
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
        foodId: f.foodId,
        catalogueId: f.catalogueId,
        source: f.source,
        quantity: quantity(i, f),
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
    async searchCatalogue(q: CatalogueQuery) {
      const result = await catalogue.search(q);
      return { ...result, items: result.items.map(catalogueDto) };
    },
    getGoals: repo.getGoals,
    saveGoals: (
      u: string,
      v: NutritionGoalsInput,
      version: number,
      context?: TransactionContext,
    ) => repo.saveGoals(u, v, version, context),
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
      return found(
        await repo.updateFood(
          u,
          id,
          {
            ...v,
            source: previous.source
              ? { ...previous.source, modified: true }
              : null,
          },
          version,
          context,
        ),
      );
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
        const food = await resolve(u, v, scope);
        if (food.archivedAt)
          throw new AppError(
            422,
            "BUSINESS_RULE",
            "This food is archived. Choose an active food.",
          );
        if (
          ("ingredientQuantities" in v ? v.ingredientQuantities : undefined) &&
          (food.kind === "food" ||
            ("ingredientQuantities" in v ? v.ingredientQuantities : undefined)!
              .length !== food.ingredients.length)
        )
          throw new AppError(
            422,
            "BUSINESS_RULE",
            "Provide one quantity for each ingredient.",
          );
        if (v.foodVersion !== undefined) assertRevision(food, v.foodVersion);
        const ingredients = food.ingredients.map((i, index) => ({
          ...i,
          quantity:
            ("ingredientQuantities" in v
              ? v.ingredientQuantities
              : undefined)?.[index] ?? i.quantity,
        }));
        const nutrients = (
          "ingredientQuantities" in v ? v.ingredientQuantities : undefined
        )
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
            ...snapshot({ ...adjusted, source: food.source }),
            foodId: food.foodId,
            catalogueId: food.catalogueId,
            consumedAt: new Date(v.consumedAt),
            quantity: quantity(v, food),
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
          sourceSnapshot: e.sourceSnapshot,
          foodId: e.foodId,
          catalogueId: e.catalogueId,
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

function catalogueDto(
  f: Awaited<ReturnType<ReturnType<typeof catalogueRepository>["get"]>>,
): CatalogueFood {
  if (!f) throw new Error("Missing catalogue row");
  return {
    id: f.id,
    version: f.version,
    provider: f.provider,
    release: f.release,
    code: f.code,
    name: f.name,
    nameFr: f.nameFr,
    updatedAt: f.sourceUpdatedAt,
    servingAmount: f.basisAmount,
    servingUnit: f.basisUnit as "g" | "ml",
    calories: f.calories,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    fiberG: f.fiberG,
    portions: f.portions,
  };
}
