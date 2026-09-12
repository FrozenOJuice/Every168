import { pgTable, integer, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  ownedColumns,
  instant,
} from "../../infrastructure/database/columns.js";
export const waterEntries = pgTable(
  "water_entries",
  {
    ...ownedColumns(),
    amountMl: integer("amount_ml").notNull(),
    consumedAt: instant("consumed_at").notNull(),
  },
  (t) => [
    index("hydration_user_time_idx").on(t.userId, t.consumedAt),
    index("hydration_user_created_idx").on(t.userId, t.createdAt, t.id),
    check("hydration_positive_value", sql`${t.amountMl}>0`),
  ],
);
