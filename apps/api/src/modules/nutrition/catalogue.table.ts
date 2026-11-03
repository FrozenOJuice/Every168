import {
  pgTable,
  text,
  jsonb,
  uuid,
  integer,
  doublePrecision,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import type { cataloguePortion } from "@168hours/contracts";
export const catalogueReleases = pgTable(
  "food_catalogue_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    release: text("release").notNull(),
    metadata: jsonb("metadata")
      .$type<{
        archiveSha256: string;
        nutrientDefinitions: Record<string, { name: string; unit: string }>;
        basis: { amount: number; unit: string };
      }>()
      .notNull(),
  },
  (t) => [unique().on(t.provider, t.release)],
);
export const catalogueFoods = pgTable(
  "food_catalogue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => catalogueReleases.id),
    provider: text("provider").notNull(),
    release: text("release").notNull(),
    code: text("code").notNull(),
    version: integer("version").default(1).notNull(),
    name: text("name").notNull(),
    nameFr: text("name_fr").notNull(),
    searchText: text("search_text").notNull(),
    sourceUpdatedAt: text("source_updated_at").notNull(),
    basisAmount: doublePrecision("basis_amount").notNull(),
    basisUnit: text("basis_unit").notNull(),
    calories: doublePrecision("calories"),
    proteinG: doublePrecision("protein_g"),
    carbsG: doublePrecision("carbs_g"),
    fatG: doublePrecision("fat_g"),
    fiberG: doublePrecision("fiber_g"),
    nutrients: jsonb("nutrients")
      .$type<Record<string, number | null>>()
      .notNull(),
    portions: jsonb("portions")
      .$type<z.infer<typeof cataloguePortion>[]>()
      .notNull(),
    contentHash: text("content_hash").notNull(),
  },
  (t) => [
    unique().on(t.provider, t.release, t.code),
    check(
      "catalogue_basis",
      sql`${t.basisAmount}>0 and ${t.basisUnit} in ('g','ml') and ${t.version}>0`,
    ),
  ],
);
