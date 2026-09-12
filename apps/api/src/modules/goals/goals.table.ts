import {
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
    unique("goal_owner_id").on(t.userId, t.id),
    index("goal_user_created_idx").on(t.userId, t.createdAt, t.id),
    foreignKey({
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
  ],
);
