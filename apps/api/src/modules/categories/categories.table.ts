import { sql } from "drizzle-orm";
import { check, pgTable, text, unique, index } from "drizzle-orm/pg-core";
import {
  ownedColumns,
  instant,
} from "../../infrastructure/database/columns.js";
export const categories = pgTable(
  "categories",
  {
    ...ownedColumns(),
    name: text("name").notNull(),
    color: text("color"),
    icon: text("icon"),
    archivedAt: instant("archived_at"),
  },
  (t) => [
    check(
      "categories_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "category_fields",
      sql`char_length(btrim(${t.name})) between 1 and 160 and (${t.color} is null or ${t.color} ~ '^#[0-9a-fA-F]{6}$') and char_length(${t.icon})<=40`,
    ),
    unique("category_owner_id").on(t.userId, t.id),
    index("category_user_idx").on(t.userId),
  ],
);
