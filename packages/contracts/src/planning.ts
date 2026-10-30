import { z } from "zod";
import {
  idSchema,
  instantSchema,
  titleSchema,
  notesSchema,
  recordSchema,
  dateSchema,
} from "./common";
export const timeFields = {
  title: titleSchema,
  categoryId: idSchema.nullable().default(null),
  startsAt: instantSchema,
  endsAt: instantSchema,
};
export function validInterval(value: { startsAt: string; endsAt: string }) {
  const duration = Date.parse(value.endsAt) - Date.parse(value.startsAt);
  return duration > 0 && duration <= 31 * 86400000;
}
export const blockInput = z
  .object({
    ...timeFields,
    goalId: idSchema.nullable().default(null),
    notes: notesSchema,
  })
  .strict()
  .refine(validInterval, {
    path: ["endsAt"],
    message: "End must be after start and within 31 days.",
  });
export const timeEntryInput = z
  .object({ ...timeFields, timeBlockId: idSchema.nullable().default(null) })
  .strict()
  .refine(validInterval, {
    path: ["endsAt"],
    message: "End must be after start and within 31 days.",
  });
export const blockSchema = recordSchema.extend({
  ...timeFields,
  seriesId: idSchema.nullable(),
  occurrenceDate: dateSchema.nullable(),
  isException: z.boolean(),
  goalId: idSchema.nullable(),
  notes: z.string().nullable(),
});
export const timeEntrySchema = recordSchema.extend({
  excludedIntervals: z
    .array(z.object({ startsAt: instantSchema, endsAt: instantSchema }))
    .optional(),
  ...timeFields,
  timeBlockId: idSchema.nullable(),
  sourceType: z.enum([
    "manual",
    "strength_workout",
    "cardio_activity",
    "task_time",
  ]),
  sourceId: idSchema.nullable(),
});
export const allocationSchema = z.object({
  categoryId: idSchema.nullable(),
  name: z.string(),
  color: z.string().nullable(),
  plannedSeconds: z.number(),
  recordedSeconds: z.number().nullable(),
});
export const weekSchema = z.object({
  weekStart: dateSchema,
  weekEnd: dateSchema,
  timezone: z.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  calendarSeconds: z.number(),
  plannedSeconds: z.number(),
  coverageSeconds: z.number(),
  unallocatedSeconds: z.number(),
  overlapSeconds: z.number(),
  overlapPairs: z.array(z.tuple([idSchema, idSchema])),
  recordedSeconds: z.number().nullable(),
  categories: z.array(allocationSchema),
  blocks: z.array(blockSchema),
  entries: z.array(timeEntrySchema),
  days: z.array(
    z.object({
      date: dateSchema,
      startsAt: instantSchema,
      endsAt: instantSchema,
      blockIds: z.array(idSchema),
      entryIds: z.array(idSchema),
    }),
  ),
});
export type BlockInput = z.infer<typeof blockInput>;
export type Block = z.infer<typeof blockSchema>;
export type TimeEntryInput = z.infer<typeof timeEntryInput>;
export type TimeEntry = z.infer<typeof timeEntrySchema>;
export type Week = z.infer<typeof weekSchema>;

export const blockDeletionSchema = z.object({
  ok: z.literal(true),
  undoId: idSchema,
});
export type BlockDeletion = z.infer<typeof blockDeletionSchema>;

export const blockEditSchema = blockSchema.extend({ undoId: idSchema });
export type BlockEdit = z.infer<typeof blockEditSchema>;
