import { pgTable, text, unique, index } from "drizzle-orm/pg-core";
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
    unique("category_owner_id").on(t.userId, t.id),
    index("category_user_idx").on(t.userId),
  ],
);
