import {
  pgTable,
  boolean,
  jsonb,
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
import type { IngredientSnapshot } from "@168hours/contracts";
export const foods = pgTable(
  "foods",
  {
    ...ownedColumns(),
    name: text("name").notNull(),
    servingAmount: doublePrecision("serving_amount").notNull(),
    servingUnit: text("serving_unit", {
      enum: ["g", "ml", "item", "serving"],
    }).notNull(),
    calories: doublePrecision("calories"),
    favourite: boolean("favourite").notNull().default(false),
    kind: text("kind", { enum: ["food", "meal", "recipe"] })
      .notNull()
      .default("food"),
    ingredients: jsonb("ingredients")
      .$type<IngredientSnapshot[]>()
      .notNull()
      .default([]),
    yieldServings: doublePrecision("yield_servings").notNull().default(1),
    instructions: text("instructions"),
    proteinG: doublePrecision("protein_g"),
    carbsG: doublePrecision("carbs_g"),
    fatG: doublePrecision("fat_g"),
    fiberG: doublePrecision("fiber_g"),
    archivedAt: instant("archived_at"),
  },
  (t) => [
    check(
      "food_preparation_bounds",
      sql`${t.kind} in ('food','meal','recipe') and ${t.yieldServings} between 1 and 1000 and char_length(${t.instructions})<=4000 and jsonb_typeof(${t.ingredients})='array' and jsonb_array_length(${t.ingredients})<=50 and (${t.kind}='recipe' or ${t.yieldServings}=1) and ((${t.kind}='food' and jsonb_array_length(${t.ingredients})=0) or (${t.kind}<>'food' and jsonb_array_length(${t.ingredients})>0 and ${t.servingAmount}=1 and ${t.servingUnit}='serving'))`,
    ),
    check(
      "foods_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "food_bounds",
      sql`char_length(btrim(${t.name})) between 1 and 160 and ${t.servingUnit} in ('g','ml','item','serving') and ${t.servingAmount}<=100000 and ${t.calories}<=100000 and ${t.proteinG}<=100000 and ${t.carbsG}<=100000 and ${t.fatG}<=100000 and ${t.fiberG}<=100000`,
    ),
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
    caloriesSnapshot: doublePrecision("calories_snapshot"),
    kindSnapshot: text("kind_snapshot", { enum: ["food", "meal", "recipe"] })
      .notNull()
      .default("food"),
    ingredientsSnapshot: jsonb("ingredients_snapshot")
      .$type<IngredientSnapshot[]>()
      .notNull()
      .default([]),
    yieldServingsSnapshot: doublePrecision("yield_servings_snapshot")
      .notNull()
      .default(1),
    proteinGSnapshot: doublePrecision("protein_g_snapshot"),
    carbsGSnapshot: doublePrecision("carbs_g_snapshot"),
    fatGSnapshot: doublePrecision("fat_g_snapshot"),
    fiberGSnapshot: doublePrecision("fiber_g_snapshot"),
  },
  (t) => [
    check(
      "food_entry_preparation_bounds",
      sql`${t.kindSnapshot} in ('food','meal','recipe') and ${t.yieldServingsSnapshot} between 1 and 1000 and jsonb_typeof(${t.ingredientsSnapshot})='array' and jsonb_array_length(${t.ingredientsSnapshot})<=50`,
    ),
    check(
      "foodEntries_revision",
      sql`${t.version}>0 and isfinite(${t.createdAt}) and isfinite(${t.updatedAt})`,
    ),
    check(
      "food_entry_bounds",
      sql`${t.quantity}<=1000 and isfinite(${t.consumedAt}) and ${t.mealType} in ('breakfast','lunch','dinner','snack','other')`,
    ),
    check(
      "food_snapshot_bounds",
      sql`char_length(btrim(${t.nameSnapshot})) between 1 and 160 and ${t.servingUnitSnapshot} in ('g','ml','item','serving') and ${t.servingAmountSnapshot}>0 and ${t.servingAmountSnapshot}<=100000 and ${t.caloriesSnapshot} between 0 and 100000 and ${t.proteinGSnapshot} between 0 and 100000 and ${t.carbsGSnapshot} between 0 and 100000 and ${t.fatGSnapshot} between 0 and 100000 and ${t.fiberGSnapshot} between 0 and 100000`,
    ),
    index("food_entry_user_consumed_idx").on(t.userId, t.consumedAt),
    index("food_entry_user_created_idx").on(t.userId, t.createdAt, t.id),
    foreignKey({
      columns: [t.userId, t.foodId],
      foreignColumns: [foods.userId, foods.id],
    }),
    check("food_entry_positive_quantity", sql`${t.quantity}>0`),
  ],
);
