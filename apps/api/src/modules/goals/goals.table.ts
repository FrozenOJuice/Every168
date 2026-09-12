import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  uuid,
  text,
  date,
  unique,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import {
  ownedColumns,
  instant,
} from "../../infrastructure/database/columns.js";
import { categories } from "../categories/categories.table.js";
export const goals = pgTable(
  "goals",
  {
    ...ownedColumns(),
    title: text("title").notNull(),
    description: text("description"),
    categoryId: uuid("category_id"),
    targetDate: date("target_date"),
    status: text("status", {
      enum: ["active", "completed", "paused", "archived"],
    })
      .notNull()
      .default("active"),
    completedAt: instant("completed_at"),
  },
  (t) => [
    check(
      "goals_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "goal_fields",
      sql`char_length(btrim(${t.title})) between 1 and 160 and char_length(${t.description})<=4000`,
    ),
    check(
      "goal_status",
      sql`${t.status} in ('active','completed','paused','archived') and ((${t.status}='completed') = (${t.completedAt} is not null)) and isfinite(${t.completedAt}) and isfinite(${t.targetDate})`,
    ),
    unique("goal_owner_id").on(t.userId, t.id),
    index("goal_user_created_idx").on(t.userId, t.createdAt, t.id),
    foreignKey({
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
  ],
);
