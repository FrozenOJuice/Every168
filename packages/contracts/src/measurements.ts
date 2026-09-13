import { z } from "zod";
import {
  recordSchema,
  instantSchema,
  dateSchema,
  pageQuerySchema,
} from "./common";
export const measurementHistoryQuery = pageQuerySchema.extend({
  through: dateSchema.optional(),
});
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
  entries: z.array(waterSchema),
});
export const weightInput = z
  .object({
    weightKg: z.number().finite().min(1).max(1000),
    measuredAt: instantSchema,
  })
  .strict();
export const weightSchema = recordSchema.extend(weightInput.shape);
export const weightReviewSchema = z.object({
  date: dateSchema,
  latest: weightSchema.nullable(),
  entries: z.array(weightSchema),
  trend: z.object({
    from: dateSchema,
    to: dateSchema,
    entries: z.array(weightSchema),
    truncated: z.boolean(),
  }),
});
export type MeasurementHistoryQuery = z.infer<typeof measurementHistoryQuery>;
export type WeightReview = z.infer<typeof weightReviewSchema>;
export type WaterInput = z.infer<typeof waterInput>;
export type Water = z.infer<typeof waterSchema>;
export type WaterDaily = z.infer<typeof waterDailySchema>;
export type WeightInput = z.infer<typeof weightInput>;
export type Weight = z.infer<typeof weightSchema>;
