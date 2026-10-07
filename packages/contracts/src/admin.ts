import { z } from "zod";
import { idSchema, instantSchema, pageQuerySchema, pageSchema } from "./common";
export const adminUsersQuery = pageQuerySchema
  .extend({
    search: z.string().trim().max(100).default(""),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .strict();
export const adminUserSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
  accountType: z.enum(["user", "admin"]),
  suspendedAt: instantSchema.nullable(),
  lastActiveAt: instantSchema.nullable(),
  createdAt: instantSchema,
  version: z.number().int().positive(),
});
export const adminUsersSchema = pageSchema(adminUserSchema);
export const adminStatusInput = z.object({ suspended: z.boolean() }).strict();
export const adminDeleteInput = z
  .object({ confirmationEmail: z.email() })
  .strict();
export const adminAuditSchema = pageSchema(
  z.object({
    id: idSchema,
    actorId: idSchema.nullable(),
    targetId: idSchema,
    action: z.enum([
      "admin_created",
      "suspended",
      "reactivated",
      "sessions_revoked",
      "account_deleted",
    ]),
    createdAt: instantSchema,
  }),
);
export const adminStatisticsSchema = z.object({
  asOf: instantSchema,
  users: z.object({
    total: z.number(),
    admins: z.number(),
    suspended: z.number(),
    new7Days: z.number(),
    active7Days: z.number(),
    active30Days: z.number(),
  }),
  usage: z.object({
    plannedBlocks: z.number(),
    foodEntries: z.number(),
    strengthWorkouts: z.number(),
    cardioActivities: z.number(),
    goals: z.number(),
  }),
});
export const adminHealthSchema = z.object({
  checkedAt: instantSchema,
  api: z.literal("ready"),
  database: z.enum(["ready", "unavailable"]),
  version: z.string(),
  uptimeSeconds: z.number(),
  requests: z.object({
    total: z.number(),
    serverErrors: z.number(),
    aborted: z.number(),
    since: instantSchema,
  }),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuery>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminAudit = z.infer<typeof adminAuditSchema>;
export type AdminStatistics = z.infer<typeof adminStatisticsSchema>;
export type AdminHealth = z.infer<typeof adminHealthSchema>;
