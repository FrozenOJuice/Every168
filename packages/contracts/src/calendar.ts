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
import { preferencesInput } from "./identity";
import { blockInput, blockSchema, timeEntrySchema } from "./planning";

export const planDetails = {
  title: titleSchema,
  categoryId: idSchema.nullable().default(null),
  goalId: idSchema.nullable().default(null),
  notes: notesSchema,
};
export const calendarItemInput = z
  .object({
    ...planDetails,
    kind: z.enum(["all_day", "unscheduled"]),
    date: dateSchema.nullable(),
    endDate: dateSchema.nullable(),
  })
  .strict()
  .refine(
    (v) =>
      v.kind === "unscheduled"
        ? v.endDate === null
        : v.date !== null &&
          v.endDate !== null &&
          v.endDate >= v.date &&
          Date.parse(v.endDate) - Date.parse(v.date) < 31 * 86400000,
    {
      path: ["endDate"],
      message:
        "All-day items need dates spanning at most 31 days; unscheduled items have no end date.",
    },
  );
export const calendarItemSchema = recordSchema.extend(calendarItemInput.shape);
export const seriesInput = z
  .object({
    ...planDetails,
    timezone: preferencesInput.shape.timezone,
    startDate: dateSchema,
    untilDate: dateSchema,
    startMinute: z.number().int().min(0).max(1439),
    durationMinutes: z
      .number()
      .int()
      .min(1)
      .max(31 * 1440),
    frequency: z.enum(["daily", "weekly"]),
    interval: z.number().int().min(1).max(52),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((v) => new Set(v).size === v.length),
  })
  .strict()
  .refine(
    (v) =>
      v.untilDate >= v.startDate &&
      Date.parse(v.untilDate) - Date.parse(v.startDate) < 366 * 86400000,
    {
      path: ["untilDate"],
      message: "Choose an end date within one year of the first day.",
    },
  );
export const seriesSchema = recordSchema.extend({
  ...seriesInput.shape,
  excludedDates: z.array(dateSchema),
});
export const seriesResultSchema = z.object({
  series: seriesSchema,
  firstStartsAt: instantSchema,
  count: z.number(),
  skippedDates: z.array(dateSchema),
  undoId: idSchema,
  blocks: z.array(
    z.object({ id: idSchema, version: z.number().int().positive() }),
  ),
});
export const seriesUndoInput = z
  .object({
    undoId: idSchema,
    blocks: z
      .array(
        z
          .object({ id: idSchema, version: z.number().int().positive() })
          .strict(),
      )
      .max(366),
  })
  .strict()
  .refine(
    (v) => new Set(v.blocks.map((b) => b.id)).size === v.blocks.length,
    "Choose distinct occurrences.",
  );
export type SeriesUndoInput = z.infer<typeof seriesUndoInput>;
export const calendarRangeQuery = z
  .object({ from: dateSchema, to: dateSchema })
  .strict()
  .refine(
    (v) =>
      v.to >= v.from && Date.parse(v.to) - Date.parse(v.from) <= 42 * 86400000,
    "Choose a range of at most 42 days.",
  );
export const calendarSearchQuery = pageQuerySchema
  .extend({
    q: z.string().trim().max(160).default(""),
    kind: z
      .enum(["all", "block", "entry", "all_day", "unscheduled"])
      .default("all"),
    categoryId: z.union([idSchema, z.literal("none")]).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "End date must follow start date.",
  );
export const searchRecordSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("block"), item: blockSchema }),
  z.object({ kind: z.literal("entry"), item: timeEntrySchema }),
  z.object({ kind: z.literal("item"), item: calendarItemSchema }),
]);
export const copyInput = z
  .object({
    sourceDate: dateSchema,
    targetDate: dateSchema,
    span: z.enum(["single", "day", "week", "range", "selection"]),
    sourceEndDate: dateSchema.optional(),
    sourceId: idSchema.optional(),
    sourceKind: z.enum(["block", "item"]).optional(),
    selectedDates: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(,\d{4}-\d{2}-\d{2}){0,30}$/)
      .optional(),
    selectedPlans: z.string().max(4400).optional(),
    targetMinute: z.coerce
      .number()
      .int()
      .min(0)
      .lt(1440)
      .multipleOf(5)
      .optional(),
  })
  .strict();
export const calendarPlanSelection = z
  .object({
    kind: z.enum(["block", "item"]),
    id: idSchema,
    version: z.number().int().positive(),
  })
  .strict();
export const groupDeleteInput = z
  .object({ plans: z.array(calendarPlanSelection).min(1).max(100) })
  .strict()
  .refine(
    (value) =>
      new Set(value.plans.map((plan) => `${plan.kind}:${plan.id}`)).size ===
      value.plans.length,
    "Select distinct plans.",
  );
export const groupDeleteUndoInput = z.object({ undoId: idSchema }).strict();
export const copyUndoInput = z
  .object({
    blocks: z
      .array(
        z
          .object({ id: idSchema, version: z.number().int().positive() })
          .strict(),
      )
      .max(100),
    items: z
      .array(
        z
          .object({ id: idSchema, version: z.number().int().positive() })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .refine(
    (v) =>
      v.blocks.length + v.items.length > 0 &&
      v.blocks.length + v.items.length <= 100,
  );
export const templateCaptureInput = z
  .object({
    name: titleSchema,
    sourceDate: dateSchema,
    span: z.enum(["day", "week", "range"]),
    sourceEndDate: dateSchema.optional(),
  })
  .strict();
export const templateRenameInput = z.object({ name: titleSchema }).strict();
export const templateApplyInput = z
  .object({
    targetDate: dateSchema,
    cycles: z.number().int().min(1).max(52).default(1),
    preferencesVersion: z.number().int().positive(),
  })
  .strict();
export const templateEntrySchema = z.object({
  ...planDetails,
  kind: z.enum(["block", "all_day", "unscheduled"]),
  dayOffset: z.number().int().min(0).max(30),
  startMinute: z.number().min(0).lt(1440).nullable(),
  durationMinutes: z
    .number()
    .positive()
    .max(31 * 1440)
    .nullable(),
  dateSpan: z.number().int().min(1).max(31).nullable(),
});
export const calendarTemplateSchema = recordSchema.extend({
  name: titleSchema,
  span: z.enum(["day", "week", "range"]),
  rangeDays: z.number().int().min(1).max(31).nullable(),
  entries: z.array(templateEntrySchema),
});
export const copyPreviewSchema = z.object({
  sourceDate: dateSchema,
  targetDate: dateSchema,
  timezone: z.string(),
  blocks: z.array(blockInput),
  items: z.array(calendarItemInput),
});
export const clipboardSnapshotSchema = copyPreviewSchema
  .pick({ sourceDate: true, timezone: true, blocks: true, items: true })
  .extend({
    timezone: preferencesInput.shape.timezone,
    blocks: z.array(blockInput).max(100),
    items: z.array(calendarItemInput).max(100),
  })
  .strict()
  .refine(
    (value) =>
      value.blocks.length + value.items.length > 0 &&
      value.blocks.length + value.items.length <= 100 &&
      value.items.every((item) => item.kind === "all_day"),
    "Copy between 1 and 100 dated plans.",
  );
export const snapshotPasteInput = z
  .object({
    snapshot: clipboardSnapshotSchema,
    targetDate: dateSchema,
    targetMinute: z.number().int().min(0).lt(1440).multipleOf(5).optional(),
  })
  .strict();
export type CalendarItem = z.infer<typeof calendarItemSchema>;
export type CalendarItemInput = z.infer<typeof calendarItemInput>;
export type SeriesInput = z.infer<typeof seriesInput>;
export type CalendarSeries = z.infer<typeof seriesSchema>;
export type SeriesResult = z.infer<typeof seriesResultSchema>;
export type CalendarSearchQuery = z.infer<typeof calendarSearchQuery>;
export type SearchRecord = z.infer<typeof searchRecordSchema>;
export type CopyInput = z.infer<typeof copyInput>;
export type ClipboardSnapshot = z.infer<typeof clipboardSnapshotSchema>;
export type SnapshotPasteInput = z.infer<typeof snapshotPasteInput>;
export type GroupDeleteInput = z.infer<typeof groupDeleteInput>;
export type GroupDeleteUndoInput = z.infer<typeof groupDeleteUndoInput>;
export type CopyUndoInput = z.infer<typeof copyUndoInput>;
export type TemplateCaptureInput = z.infer<typeof templateCaptureInput>;
export type TemplateEntry = z.infer<typeof templateEntrySchema>;
export type CalendarTemplate = z.infer<typeof calendarTemplateSchema>;
export type CopyPreview = z.infer<typeof copyPreviewSchema>;
