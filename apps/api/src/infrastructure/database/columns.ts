import { uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { user } from "../../modules/identity/identity.table.js";
export const ownedColumns = () => ({
  id: uuid("id").defaultRandom().primaryKey(),
  version: integer("version").default(1).notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
    .defaultNow()
    .notNull(),
});
export const instant = (name: string) =>
  timestamp(name, { withTimezone: true, precision: 3 });
