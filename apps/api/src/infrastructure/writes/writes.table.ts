import {
  pgTable,
  uuid,
  text,
  jsonb,
  primaryKey,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "../../modules/identity/identity.table.js";

export const writeReceipts = pgTable(
  "write_receipts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: uuid("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    response: jsonb("response").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
