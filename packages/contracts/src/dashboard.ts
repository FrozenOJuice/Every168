import { workoutSummarySchema, cardioSchema } from "./exercise";
import { nutritionTotalsSchema } from "./nutrition";
import { waterDailySchema, weightSchema } from "./measurements";
import { z } from "zod";
import { dateSchema, instantSchema } from "./common";
import { weekSchema, blockSchema } from "./planning";
import { goalSchema } from "./goals";
export const dashboardSchema = z.object({
  lastWorkout: workoutSummarySchema.nullable(),
  lastCardio: cardioSchema.nullable(),
  nutrition: z.object({ count: z.number(), totals: nutritionTotalsSchema }),
  water: waterDailySchema,
  weight: weightSchema.nullable(),
  today: dateSchema,
  now: instantSchema,
  week: weekSchema,
  todayBlocks: z.array(blockSchema),
  goals: z.array(goalSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
