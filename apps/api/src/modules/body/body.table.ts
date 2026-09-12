import { pgTable, doublePrecision, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  ownedColumns,
  instant,
} from "../../infrastructure/database/columns.js";
export const weightEntries = pgTable(
  "weight_entries",
  {
    ...ownedColumns(),
    weightKg: doublePrecision("weight_kg").notNull(),
    measuredAt: instant("measured_at").notNull(),
  },
  (t) => [
    index("body_user_time_idx").on(t.userId, t.measuredAt),
    index("body_user_created_idx").on(t.userId, t.createdAt, t.id),
    check("body_positive_value", sql`${t.weightKg}>0`),
  ],
);
