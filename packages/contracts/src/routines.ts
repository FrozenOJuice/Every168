import { z } from "zod";
import { instantSchema, recordSchema, titleSchema } from "./common";

export const routineInput = z
  .object({
    name: titleSchema,
    steps: z.array(z.string().trim().min(1).max(160)).min(1).max(50),
  })
  .strict();
export const routineSchema = recordSchema.extend({
  ...routineInput.shape,
  checked: z.array(z.number().int().min(0)),
  runCount: z.number().int().min(0),
  lastCompletedAt: instantSchema.nullable(),
});
export const routineProgressInput = z
  .object({
    checked: z.array(z.number().int().min(0)).max(50),
  })
  .strict();
export type Routine = z.infer<typeof routineSchema>;
export type RoutineInput = z.infer<typeof routineInput>;
export type RoutineProgressInput = z.infer<typeof routineProgressInput>;
