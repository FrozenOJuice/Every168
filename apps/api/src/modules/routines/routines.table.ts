import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  jsonb,
  integer,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { ownedColumns } from "../../infrastructure/database/columns.js";

export const routines = pgTable(
  "routines",
  {
    ...ownedColumns(),
    name: text("name").notNull(),
    steps: jsonb("steps").$type<string[]>().notNull(),
    checked: integer("checked")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    runCount: integer("run_count").notNull().default(0),
    lastCompletedAt: timestamp("last_completed_at", {
      withTimezone: true,
      precision: 3,
    }),
  },
  (t) => [
    index("routines_owner_created_idx").on(t.userId, t.createdAt, t.id),
    check(
      "routines_fields",
      sql`${t.version}>0 and char_length(btrim(${t.name})) between 1 and 160 and jsonb_typeof(${t.steps})='array' and jsonb_array_length(${t.steps}) between 1 and 50 and cardinality(${t.checked})<=50 and ${t.runCount}>=0`,
    ),
  ],
);
