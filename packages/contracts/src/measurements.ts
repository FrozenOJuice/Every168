import { z } from "zod";
import { recordSchema, instantSchema, dateSchema } from "./common";
export const waterInput = z
  .object({
    amountMl: z.number().int().positive().max(10000),
    consumedAt: instantSchema,
  })
  .strict();
export const waterSchema = recordSchema.extend(waterInput.shape);
export const waterDailySchema = z.object({
  date: dateSchema,
  totalMl: z.number().nullable(),
  count: z.number(),
});
export const weightInput = z
  .object({
    weightKg: z.number().finite().min(1).max(1000),
    measuredAt: instantSchema,
  })
  .strict();
export const weightSchema = recordSchema.extend(weightInput.shape);
export type WaterInput = z.infer<typeof waterInput>;
export type Water = z.infer<typeof waterSchema>;
export type WaterDaily = z.infer<typeof waterDailySchema>;
export type WeightInput = z.infer<typeof weightInput>;
export type Weight = z.infer<typeof weightSchema>;
