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
import { validInterval } from "./planning";
export const taskRepeatSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "monthly"]),
    until: dateSchema.nullable().default(null),
  })
  .strict();
export const taskInput = z
  .object({
    title: titleSchema.min(1, "Enter a task title."),
    notes: notesSchema,
    inbox: z.boolean().default(true),
    projectId: idSchema.nullable().default(null),
    sectionId: idSchema.nullable().default(null),
    dueDate: dateSchema.nullable().default(null),
    plannedDate: dateSchema.nullable().default(null),
    priority: z.enum(["none", "low", "medium", "high"]).default("none"),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .default([])
      .transform((v) => [...new Set(v.map((x) => x.toLowerCase()))]),
    subtasks: z
      .array(
        z
          .object({ id: idSchema, title: titleSchema, completed: z.boolean() })
          .strict(),
      )
      .max(100)
      .default([])
      .refine(
        (v) => new Set(v.map((x) => x.id)).size === v.length,
        "Subtasks must have unique identities.",
      ),
    repeat: taskRepeatSchema.nullable().default(null),
  })
  .strict();
export const taskSchema = recordSchema.extend(taskInput.shape).extend({
  status: z.enum(["todo", "in_progress", "done", "skipped"]),
  archived: z.boolean(),
  completedAt: instantSchema.nullable(),
  position: z.number(),
  recurrenceKey: idSchema.nullable(),
  recurrenceAnchor: dateSchema.nullable(),
  occurrenceDate: dateSchema.nullable(),
  advanced: z.boolean(),
  repeatTemplate: taskInput.nullable(),
});
export const projectInput = z
  .object({
    name: titleSchema.min(1, "Enter a project name."),
    description: notesSchema,
    targetDate: dateSchema.nullable().default(null),
    status: z.enum(["active", "completed", "archived"]).default("active"),
    sections: z
      .array(z.object({ id: idSchema, title: titleSchema }).strict())
      .max(50)
      .default([])
      .refine(
        (v) => new Set(v.map((x) => x.id)).size === v.length,
        "Sections must have unique identities.",
      ),
  })
  .strict();
export const projectSchema = recordSchema
  .extend(projectInput.shape)
  .extend({ taskCount: z.number(), completedCount: z.number() });
export const tasksQuery = pageQuerySchema.extend({
  view: z.enum(["inbox", "today", "upcoming", "all"]).default("inbox"),
  date: dateSchema,
  q: z.string().trim().max(160).default(""),
  status: z.enum(["active", "done", "skipped", "all"]).default("active"),
  archived: z.enum(["false", "true"]).default("false"),
  projectId: idSchema.optional(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
  tag: z.string().max(40).optional(),
});
export const taskStateInput = z
  .object({
    status: z.enum(["todo", "in_progress", "done", "skipped"]).optional(),
    archived: z.boolean().optional(),
    inbox: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Choose a change.");
export const taskMoveInput = z
  .object({ direction: z.enum(["up", "down"]) })
  .strict();
export const taskTimeInput = z
  .object({
    startsAt: instantSchema,
    endsAt: instantSchema,
    notes: notesSchema,
  })
  .strict()
  .refine(validInterval, {
    path: ["endsAt"],
    message: "End must be after start and within 31 days.",
  });
export const taskScheduleInput = taskTimeInput;
export const taskTimeSchema = recordSchema
  .extend(taskTimeInput.shape)
  .extend({ taskId: idSchema });
export const taskDetailSchema = z.object({
  task: taskSchema,
  times: z.array(taskTimeSchema),
  schedules: z.array(
    z.object({
      id: idSchema,
      version: z.number(),
      taskId: idSchema,
      timeBlockId: idSchema,
      startsAt: instantSchema,
      endsAt: instantSchema,
      title: z.string(),
      blockVersion: z.number(),
    }),
  ),
});
export type Task = z.infer<typeof taskSchema>;
export type TaskInput = z.infer<typeof taskInput>;
export type TaskRepeat = z.infer<typeof taskRepeatSchema>;
export type TaskQuery = z.infer<typeof tasksQuery>;
export type TaskStateInput = z.infer<typeof taskStateInput>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectInput = z.infer<typeof projectInput>;
export type TaskTimeInput = z.infer<typeof taskTimeInput>;
export type TaskTime = z.infer<typeof taskTimeSchema>;
export type TaskDetail = z.infer<typeof taskDetailSchema>;
