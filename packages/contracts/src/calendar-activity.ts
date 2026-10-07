import { z } from "zod";
import { idSchema, instantSchema } from "./common";

export const calendarActivitySchema = z.object({
  source: z.object({ type: z.string(), id: idSchema }),
  domain: z.string(),
  icon: z.string(),
  kind: z.enum(["moment", "session"]),
  status: z.enum(["recorded", "draft"]),
  title: z.string(),
  summary: z.string(),
  occurredAt: instantSchema,
  endsAt: instantSchema.nullable(),
  href: z.string().regex(/^\/(?!\/)/),
});
export const calendarActivityResultSchema = z.object({
  timezone: z.string(),
  entries: z.array(calendarActivitySchema),
  truncatedSources: z.array(z.object({ label: z.string(), href: z.string() })),
});
export type CalendarActivity = z.infer<typeof calendarActivitySchema>;
export type CalendarActivityResult = z.infer<
  typeof calendarActivityResultSchema
>;
// Each domain owns its projection; Calendar only composes the common envelope.
export type CalendarContribution = {
  entries: CalendarActivity[];
  truncated: boolean;
  label: string;
  href: string;
};
export const CALENDAR_ACTIVITY_LIMIT = 200;
