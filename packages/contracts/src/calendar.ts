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
});
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
    span: z.enum(["day", "week"]),
  })
  .strict();
export const templateCaptureInput = z
  .object({
    name: titleSchema,
    sourceDate: dateSchema,
    span: z.enum(["day", "week"]),
  })
  .strict();
export const templateRenameInput = z.object({ name: titleSchema }).strict();
export const templateApplyInput = z
  .object({
    targetDate: dateSchema,
    preferencesVersion: z.number().int().positive(),
  })
  .strict();
export const templateEntrySchema = z.object({
  ...planDetails,
  kind: z.enum(["block", "all_day", "unscheduled"]),
  dayOffset: z.number().int().min(0).max(6),
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
  span: z.enum(["day", "week"]),
  entries: z.array(templateEntrySchema),
});
export const copyPreviewSchema = z.object({
  sourceDate: dateSchema,
  targetDate: dateSchema,
  timezone: z.string(),
  blocks: z.array(blockInput),
  items: z.array(calendarItemInput),
});
export type CalendarItem = z.infer<typeof calendarItemSchema>;
export type CalendarItemInput = z.infer<typeof calendarItemInput>;
export type SeriesInput = z.infer<typeof seriesInput>;
export type CalendarSeries = z.infer<typeof seriesSchema>;
export type SeriesResult = z.infer<typeof seriesResultSchema>;
export type CalendarSearchQuery = z.infer<typeof calendarSearchQuery>;
export type SearchRecord = z.infer<typeof searchRecordSchema>;
export type CopyInput = z.infer<typeof copyInput>;
export type TemplateCaptureInput = z.infer<typeof templateCaptureInput>;
export type TemplateEntry = z.infer<typeof templateEntrySchema>;
export type CalendarTemplate = z.infer<typeof calendarTemplateSchema>;
export type CopyPreview = z.infer<typeof copyPreviewSchema>;
