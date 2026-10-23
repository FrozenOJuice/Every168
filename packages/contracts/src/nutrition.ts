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
export const ingredientInput = z
  .object({
    foodId: idSchema,
    quantity: z.number().finite().positive().max(1000),
  })
  .strict();
export const ingredientSnapshotSchema = z.object({
  ...foodInput.omit({ favourite: true }).shape,
  foodId: idSchema,
  quantity: ingredientInput.shape.quantity,
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
export const foodEntryInput = foodEntryUpdate
  .extend({
    foodId: idSchema,
    foodVersion: z.number().int().positive().optional(),
    ingredientQuantities: z
      .array(ingredientInput.shape.quantity)
      .min(1)
      .max(50)
      .optional(),
  })
  .refine((v) => !v.ingredientQuantities || v.foodVersion !== undefined, {
    path: ["foodVersion"],
    message:
      "Review the saved preparation before changing ingredient quantities.",
  });
export const quickFoodInput = foodEntryUpdate
  .extend({ food: foodInput.omit({ favourite: true }) })
  .strict();
export type QuickFoodInput = z.infer<typeof quickFoodInput>;

export const foodEntrySchema = recordSchema.extend({
  ...foodEntryUpdate.shape,
  foodId: idSchema.nullable(),
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
