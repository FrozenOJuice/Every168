import { z } from "zod";
import {
  recordSchema,
  titleSchema,
  notesSchema,
  idSchema,
  dateSchema,
  instantSchema,
  pageQuerySchema,
} from "./common";
export const goalStatus = z.enum(["active", "completed", "paused", "archived"]);
export const goalInput = z
  .object({
    title: titleSchema,
    description: notesSchema,
    categoryId: idSchema.nullable().default(null),
    targetDate: dateSchema.nullable().default(null),
    status: goalStatus.default("active"),
  })
  .strict();
export const goalSchema = recordSchema.extend({
  ...goalInput.shape,
  completedAt: instantSchema.nullable(),
});
export const goalsQuery = pageQuerySchema.extend({
  status: goalStatus.optional(),
});
export type GoalInput = z.infer<typeof goalInput>;
export type Goal = z.infer<typeof goalSchema>;
export type GoalsQuery = z.infer<typeof goalsQuery>;
