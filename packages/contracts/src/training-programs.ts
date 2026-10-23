import { z } from "zod";
import {
  dateSchema,
  idSchema,
  instantSchema,
  notesSchema,
  pageQuerySchema,
  recordSchema,
  titleSchema,
} from "./common";
import { blockSchema } from "./planning";
import { strengthPlanSchema, strengthScheduleInput } from "./exercise";

export const trainingProgramInput = z
  .object({
    title: titleSchema,
    notes: notesSchema,
    startDate: dateSchema,
    trainingDays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .default([])
      .refine(
        (v) => new Set(v).size === v.length,
        "Choose each training day once.",
      ),
    paused: z.boolean().default(false),
    steps: z
      .array(
        z.object({ id: idSchema.optional(), workoutId: idSchema }).strict(),
      )
      .min(1, "Add at least one workout.")
      .max(20),
  })
  .strict();
export type TrainingProgramInput = z.infer<typeof trainingProgramInput>;
export const trainingProgramQuery = pageQuerySchema.extend({
  paused: z.enum(["all", "active", "paused"]).default("active"),
});
export type TrainingProgramQuery = z.infer<typeof trainingProgramQuery>;
export const programSequenceInput = z
  .object({ sequence: z.number().int().min(0).max(1000000) })
  .strict();
export const programBeginInput = programSequenceInput.extend({
  startedAt: instantSchema,
});
export const programScheduleInput = strengthScheduleInput.safeExtend({
  sequence: programSequenceInput.shape.sequence,
  blockVersion: z.number().int().positive().nullable().default(null),
});
export type ProgramScheduleInput = z.infer<typeof programScheduleInput>;
export const programStepSchema = z.object({
  id: idSchema,
  workoutId: idSchema,
  title: z.string(),
  available: z.boolean(),
});
export const programOccurrenceSchema = recordSchema.extend({
  programId: idSchema,
  sequence: z.number(),
  cycle: z.number(),
  position: z.number(),
  stepId: idSchema,
  workoutTitleSnapshot: z.string(),
  plannedDate: dateSchema.nullable(),
  planId: idSchema.nullable(),
  skippedAt: instantSchema.nullable(),
  session: z
    .object({
      id: idSchema,
      startedAt: instantSchema,
      endedAt: instantSchema.nullable(),
    })
    .nullable(),
  status: z.enum([
    "ready",
    "scheduled",
    "in_progress",
    "completed",
    "skipped",
    "unrecorded",
  ]),
});
export type ProgramOccurrence = z.infer<typeof programOccurrenceSchema>;
export const trainingProgramSchema = recordSchema.extend({
  title: z.string(),
  notes: z.string().nullable(),
  startDate: dateSchema,
  trainingDays: z.array(z.number()),
  paused: z.boolean(),
  steps: z.array(programStepSchema),
  completedCount: z.number(),
  skippedCount: z.number(),
  next: z.object({
    sequence: z.number(),
    cycle: z.number(),
    position: z.number(),
    stepId: idSchema,
    workoutId: idSchema.nullable(),
    title: z.string(),
    suggestedDate: dateSchema,
    available: z.boolean(),
    occurrence: programOccurrenceSchema.nullable(),
    plan: strengthPlanSchema.nullable(),
    block: blockSchema.nullable(),
  }),
});
export type TrainingProgram = z.infer<typeof trainingProgramSchema>;

export const programSkipInput = programSequenceInput.extend({
  blockVersion: z.number().int().positive().nullable().default(null),
});
export const programPauseInput = z.object({ paused: z.boolean() }).strict();
export type ProgramSkipInput = z.infer<typeof programSkipInput>;
export type ProgramBeginInput = z.infer<typeof programBeginInput>;

export const programSessionLinkSchema = z.object({
  program: z.object({ programId: idSchema, title: z.string() }).nullable(),
});
export type ProgramSessionLink = z.infer<typeof programSessionLinkSchema>;
