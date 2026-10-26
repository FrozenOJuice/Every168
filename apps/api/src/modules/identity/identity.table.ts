import { sql } from "drizzle-orm";
import {
  check,
  unique,
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
const dates = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const user = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    accountType: text("account_type", { enum: ["user", "admin"] })
      .notNull()
      .default("user"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    ...dates(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "user_access_values",
      sql`${t.accountType} in ('user','admin') and ${t.version}>0 and (${t.accountType}='user' or ${t.suspendedAt} is null)`,
    ),
    index("user_created_idx").on(t.createdAt, t.id),
    index("user_active_idx").on(t.lastActiveAt),
  ],
);
export const session = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...dates(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...dates(),
  },
  (t) => [
    index("account_user_idx").on(t.userId),
    unique("account_provider_identity").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...dates(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const preferences = pgTable(
  "preferences",
  {
    version: integer("version").default(1).notNull(),
    userId: uuid("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    timezone: text("timezone").notNull().default("UTC"),
    weekStartsOn: integer("week_starts_on").notNull().default(1),
    weightUnit: text("weight_unit", { enum: ["kg", "lb"] })
      .notNull()
      .default("kg"),
    durationUnit: text("duration_unit", { enum: ["min_sec", "s", "min", "h"] })
      .notNull()
      .default("min_sec"),
    distanceUnit: text("distance_unit", { enum: ["m", "km", "yd", "mi"] })
      .notNull()
      .default("km"),
    ...dates(),
  },
  (t) => [
    check(
      "preferences_values",
      sql`${t.version}>0 and ${t.weekStartsOn} in (0,1) and ${t.weightUnit} in ('kg','lb') and ${t.distanceUnit} in ('m','km','yd','mi') and ${t.durationUnit} in ('min_sec','s','min','h') and char_length(${t.timezone}) between 1 and 100`,
    ),
  ],
);

// Audit identifiers deliberately survive account deletion; no personal payloads.
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id"),
    targetId: uuid("target_id").notNull(),
    action: text("action", {
      enum: [
        "admin_created",
        "suspended",
        "reactivated",
        "sessions_revoked",
        "account_deleted",
      ],
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("admin_audit_created_idx").on(t.createdAt, t.id),
    check(
      "admin_audit_action",
      sql`${t.action} in ('admin_created','suspended','reactivated','sessions_revoked','account_deleted')`,
    ),
  ],
);
