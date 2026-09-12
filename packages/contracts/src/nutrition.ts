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
    calories: z.number().finite().min(0).max(100000),
    proteinG: nutrientInput,
    carbsG: nutrientInput,
    fatG: nutrientInput,
    fiberG: nutrientInput,
  })
  .strict();
export const foodSchema = recordSchema.extend({
  ...foodInput.shape,
  archivedAt: instantSchema.nullable(),
});
export const libraryQuery = pageQuerySchema.extend({
  archived: z.enum(["true", "false"]).default("false"),
  search: z.string().trim().max(100).default(""),
});
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
export const foodEntryInput = foodEntryUpdate.extend({ foodId: idSchema });
export const foodEntrySchema = recordSchema.extend({
  ...foodEntryUpdate.shape,
  foodId: idSchema.nullable(),
  nameSnapshot: z.string(),
  servingAmountSnapshot: z.number(),
  servingUnitSnapshot: z.string(),
  caloriesSnapshot: z.number(),
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
export const nutritionDailySchema = z.object({
  date: dateSchema,
  count: z.number(),
  totals: nutritionTotalsSchema,
  entries: z.array(foodEntrySchema),
});
export type FoodInput = z.infer<typeof foodInput>;
export type Food = z.infer<typeof foodSchema>;
export type LibraryQuery = z.infer<typeof libraryQuery>;
export type FoodEntryInput = z.infer<typeof foodEntryInput>;
export type FoodEntryUpdate = z.infer<typeof foodEntryUpdate>;
export type FoodEntry = z.infer<typeof foodEntrySchema>;
export type NutritionDaily = z.infer<typeof nutritionDailySchema>;
export type NutritionTotals = z.infer<typeof nutritionTotalsSchema>;
