import {
  and,
  eq,
  desc,
  asc,
  gte,
  lt,
  isNull,
  isNotNull,
  ilike,
} from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import type {
  FoodInput,
  FoodEntryUpdate,
  LibraryQuery,
} from "@168hours/contracts";
import { cursorCondition, pageResult } from "../../shared/http/pagination.js";
import { foods, foodEntries } from "./nutrition.table.js";
export function nutritionRepository(db: Database) {
  const foodOwner = (u: string, id: string) =>
    and(eq(foods.userId, u), eq(foods.id, id));
  const entryOwner = (u: string, id: string) =>
    and(eq(foodEntries.userId, u), eq(foodEntries.id, id));
  return {
    async listFoods(u: string, q: LibraryQuery) {
      const rows = await db
        .select()
        .from(foods)
        .where(
          and(
            eq(foods.userId, u),
            q.archived === "true"
              ? isNotNull(foods.archivedAt)
              : isNull(foods.archivedAt),
            q.search
              ? ilike(foods.name, "%" + q.search.replace(/[\%_]/g, "\$&") + "%")
              : undefined,
            cursorCondition(q, foods.createdAt, foods.id),
          ),
        )
        .orderBy(desc(foods.createdAt), desc(foods.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async getFood(u: string, id: string) {
      return (await db.select().from(foods).where(foodOwner(u, id)))[0];
    },
    async createFood(u: string, v: FoodInput) {
      return (
        await db
          .insert(foods)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async updateFood(
      u: string,
      id: string,
      v: Partial<FoodInput> & { archivedAt?: Date },
    ) {
      return (
        await db
          .update(foods)
          .set({ ...v, updatedAt: new Date() })
          .where(foodOwner(u, id))
          .returning()
      )[0];
    },
    async getEntry(u: string, id: string) {
      return (await db.select().from(foodEntries).where(entryOwner(u, id)))[0];
    },
    async createEntry(
      u: string,
      v: Omit<typeof foodEntries.$inferInsert, "userId">,
    ) {
      return (
        await db
          .insert(foodEntries)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async updateEntry(u: string, id: string, v: FoodEntryUpdate) {
      return (
        await db
          .update(foodEntries)
          .set({
            ...v,
            consumedAt: new Date(v.consumedAt),
            updatedAt: new Date(),
          })
          .where(entryOwner(u, id))
          .returning()
      )[0];
    },
    async deleteEntry(u: string, id: string) {
      return (
        await db.delete(foodEntries).where(entryOwner(u, id)).returning()
      )[0];
    },
    entriesInRange: (u: string, start: string, end: string) =>
      db
        .select()
        .from(foodEntries)
        .where(
          and(
            eq(foodEntries.userId, u),
            gte(foodEntries.consumedAt, new Date(start)),
            lt(foodEntries.consumedAt, new Date(end)),
          ),
        )
        .orderBy(asc(foodEntries.consumedAt), asc(foodEntries.id)),
  };
}
