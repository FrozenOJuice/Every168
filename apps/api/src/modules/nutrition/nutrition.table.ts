import {
  pgTable,
  text,
  uuid,
  doublePrecision,
  index,
  unique,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  ownedColumns,
  instant,
} from "../../infrastructure/database/columns.js";
export const foods = pgTable(
  "foods",
  {
    ...ownedColumns(),
    name: text("name").notNull(),
    servingAmount: doublePrecision("serving_amount").notNull(),
    servingUnit: text("serving_unit", {
      enum: ["g", "ml", "item", "serving"],
    }).notNull(),
    calories: doublePrecision("calories").notNull(),
    proteinG: doublePrecision("protein_g"),
    carbsG: doublePrecision("carbs_g"),
    fatG: doublePrecision("fat_g"),
    fiberG: doublePrecision("fiber_g"),
    archivedAt: instant("archived_at"),
  },
  (t) => [
    unique("food_owner_id").on(t.userId, t.id),
    index("food_user_created_idx").on(t.userId, t.createdAt, t.id),
    check("food_positive_serving", sql`${t.servingAmount}>0`),
    check(
      "food_nonnegative_nutrients",
      sql`${t.calories}>=0 and ${t.proteinG}>=0 and ${t.carbsG}>=0 and ${t.fatG}>=0 and ${t.fiberG}>=0`,
    ),
  ],
);
export const foodEntries = pgTable(
  "food_entries",
  {
    ...ownedColumns(),
    foodId: uuid("food_id"),
    consumedAt: instant("consumed_at").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    mealType: text("meal_type", {
      enum: ["breakfast", "lunch", "dinner", "snack", "other"],
    }).notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    servingAmountSnapshot: doublePrecision("serving_amount_snapshot").notNull(),
    servingUnitSnapshot: text("serving_unit_snapshot").notNull(),
    caloriesSnapshot: doublePrecision("calories_snapshot").notNull(),
    proteinGSnapshot: doublePrecision("protein_g_snapshot"),
    carbsGSnapshot: doublePrecision("carbs_g_snapshot"),
    fatGSnapshot: doublePrecision("fat_g_snapshot"),
    fiberGSnapshot: doublePrecision("fiber_g_snapshot"),
  },
  (t) => [
    index("food_entry_user_consumed_idx").on(t.userId, t.consumedAt),
    foreignKey({
      columns: [t.userId, t.foodId],
      foreignColumns: [foods.userId, foods.id],
    }),
    check("food_entry_positive_quantity", sql`${t.quantity}>0`),
  ],
);
