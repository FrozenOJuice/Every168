import { z } from "zod";
import {
  recordSchema,
  titleSchema,
  instantSchema,
  idSchema,
  pageQuerySchema,
  dateSchema,
} from "./common";
export const nutrientInput = z
  .number()
  .finite()
  .min(0)
  .max(100000)
  .nullable()
  .default(null);
export const foodSourceSchema = z.object({
  provider: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
  release: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(100),
  name: titleSchema,
  modified: z.boolean(),
});
export type FoodSource = z.infer<typeof foodSourceSchema>;
export const catalogueQuery = z
  .object({
    search: z.string().trim().max(100).default(""),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type CatalogueQuery = z.infer<typeof catalogueQuery>;
export const foodInput = z
  .object({
    name: titleSchema,
    servingAmount: z.number().finite().positive().max(100000),
    servingUnit: z.enum(["g", "ml", "item", "serving"]),
    calories: nutrientInput,
    favourite: z.boolean().optional(),
    proteinG: nutrientInput,
    carbsG: nutrientInput,
    fatG: nutrientInput,
    fiberG: nutrientInput,
  })
  .strict();
export const foodKind = z.enum(["food", "meal", "recipe"]);
export const foodQuantity = z.number().finite().positive().max(1000);
export const portionId = z.string().trim().min(1).max(40);
// These distinct wire identifiers are never interchangeable: owned references require owner lookup.
export const ingredientInput = z.union([
  z
    .object({
      foodId: idSchema,
      catalogueId: z.never().optional(),
      quantity: foodQuantity,
    })
    .strict(),
  z
    .object({
      catalogueId: idSchema,
      foodId: z.never().optional(),
      quantity: z.number().finite().positive().max(100000),
      portionId: portionId.optional(),
    })
    .strict(),
]);
export const ingredientSnapshotSchema = z.object({
  ...foodInput.omit({ favourite: true }).shape,
  foodId: idSchema.nullable(),
  catalogueId: idSchema.nullish(),
  source: foodSourceSchema.nullish(),
  quantity: foodQuantity,
});
export type IngredientSnapshot = z.infer<typeof ingredientSnapshotSchema>;
export const preparationInput = z
  .object({
    name: titleSchema,
    kind: z.enum(["meal", "recipe"]),
    ingredients: z.array(ingredientInput).min(1).max(50),
    yieldServings: z.number().finite().min(1).max(1000).default(1),
    instructions: z.string().trim().max(4000).nullable().default(null),
    favourite: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.kind !== "meal" || v.yieldServings === 1, {
    path: ["yieldServings"],
    message:
      "A saved meal represents one meal; use a recipe for multiple portions.",
  });
export type PreparationInput = z.infer<typeof preparationInput>;
export const foodFavouriteInput = z.object({ favourite: z.boolean() }).strict();
export const foodSchema = recordSchema.extend({
  ...foodInput.shape,
  source: foodSourceSchema.nullish(),
  archivedAt: instantSchema.nullable(),
  favourite: z.boolean(),
  kind: foodKind,
  ingredients: z.array(ingredientSnapshotSchema),
  yieldServings: z.number(),
  instructions: z.string().nullable(),
});
export const libraryQuery = pageQuerySchema.extend({
  kind: foodKind.optional(),
  favourite: z.enum(["true", "false"]).optional(),
  archived: z.enum(["true", "false"]).default("false"),
  search: z.string().trim().max(100).default(""),
});
export const foodHistoryQuery = pageQuerySchema
  .extend({
    date: dateSchema.optional(),
    search: z.string().trim().max(100).default(""),
  })
  .strict();
export const mealType = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
]);
export const foodEntryUpdate = z
  .object({
    consumedAt: instantSchema,
    quantity: z.number().finite().positive().max(1000),
    mealType: mealType.default("other"),
  })
  .strict();
export const foodEntryInput = z.union([
  foodEntryUpdate
    .extend({
      foodId: idSchema,
      catalogueId: z.never().optional(),
      foodVersion: z.number().int().positive().optional(),
      ingredientQuantities: z.array(foodQuantity).min(1).max(50).optional(),
    })
    .strict()
    .refine((v) => !v.ingredientQuantities || v.foodVersion !== undefined, {
      path: ["foodVersion"],
      message:
        "Review the saved preparation before changing ingredient quantities.",
    }),
  foodEntryUpdate
    .extend({
      catalogueId: idSchema,
      foodId: z.never().optional(),
      quantity: z.number().finite().positive().max(100000),
      portionId: portionId.optional(),
      foodVersion: z.number().int().positive().optional(),
    })
    .strict(),
]);
export const quickFoodInput = foodEntryUpdate
  .extend({ food: foodInput.omit({ favourite: true }) })
  .strict();
export type QuickFoodInput = z.infer<typeof quickFoodInput>;

export const foodEntrySchema = recordSchema.extend({
  ...foodEntryUpdate.shape,
  foodId: idSchema.nullable(),
  catalogueId: idSchema.nullish(),
  sourceSnapshot: foodSourceSchema.nullish(),
  nameSnapshot: z.string(),
  servingAmountSnapshot: z.number(),
  servingUnitSnapshot: z.string(),
  caloriesSnapshot: z.number().nullable(),
  kindSnapshot: foodKind,
  ingredientsSnapshot: z.array(ingredientSnapshotSchema),
  yieldServingsSnapshot: z.number(),
  proteinGSnapshot: z.number().nullable(),
  carbsGSnapshot: z.number().nullable(),
  fatGSnapshot: z.number().nullable(),
  fiberGSnapshot: z.number().nullable(),
});
export const knownTotal = z.object({
  value: z.number().nullable(),
  unknownCount: z.number(),
});
export const nutritionTotalsSchema = z.object({
  calories: knownTotal,
  proteinG: knownTotal,
  carbsG: knownTotal,
  fatG: knownTotal,
  fiberG: knownTotal,
});
export const foodEntryDetailSchema = foodEntrySchema.extend({
  nutrition: nutritionTotalsSchema,
});
export const mealSummarySchema = z.object({
  mealType,
  count: z.number().int().nonnegative(),
  totals: nutritionTotalsSchema,
});
export const nutritionDailySchema = z.object({
  date: dateSchema,
  count: z.number(),
  totals: nutritionTotalsSchema,
  entries: z.array(foodEntryDetailSchema),
  meals: z.array(mealSummarySchema),
});
export type FoodInput = z.infer<typeof foodInput>;
export type Food = z.infer<typeof foodSchema>;
export type LibraryQuery = z.infer<typeof libraryQuery>;
export type FoodHistoryQuery = z.infer<typeof foodHistoryQuery>;
export type FoodEntryDetail = z.infer<typeof foodEntryDetailSchema>;
export type FoodEntryInput = z.infer<typeof foodEntryInput>;
export type FoodEntryUpdate = z.infer<typeof foodEntryUpdate>;
export type FoodEntry = z.infer<typeof foodEntrySchema>;
export type NutritionDaily = z.infer<typeof nutritionDailySchema>;
export type NutritionTotals = z.infer<typeof nutritionTotalsSchema>;

export const cataloguePortion = z.object({
  id: portionId,
  label: z.string().min(1).max(300),
  grams: z.number().finite().positive().max(100000),
});
export const catalogueFoodSchema = foodInput.omit({ favourite: true }).extend({
  id: idSchema,
  version: z.number().int().positive(),
  provider: foodSourceSchema.shape.provider,
  code: z.string().min(1).max(100),
  release: foodSourceSchema.shape.release,
  nameFr: z.string(),
  updatedAt: z.string(),
  portions: z.array(cataloguePortion),
});
export type CatalogueFood = z.infer<typeof catalogueFoodSchema>;
export type FoodSelection =
  { type: "owned"; food: Food } | { type: "catalogue"; food: CatalogueFood };
export const catalogueResultSchema = z.object({
  items: z.array(catalogueFoodSchema),
  nextOffset: z.number().int().nullable(),
  total: z.number().int(),
});
export type CatalogueResult = z.infer<typeof catalogueResultSchema>;
export const nutritionGoalsInput = z
  .object({
    calories: z
      .number()
      .finite()
      .positive()
      .max(100000)
      .nullable()
      .default(null),
    proteinG: z
      .number()
      .finite()
      .positive()
      .max(100000)
      .nullable()
      .default(null),
    carbsG: z.number().finite().positive().max(100000).nullable().default(null),
    fatG: z.number().finite().positive().max(100000).nullable().default(null),
  })
  .strict();
export const nutritionGoalsSchema = nutritionGoalsInput.extend({
  version: z.number().int().positive(),
});
export type NutritionGoalsInput = z.infer<typeof nutritionGoalsInput>;
export type NutritionGoals = z.infer<typeof nutritionGoalsSchema>;
