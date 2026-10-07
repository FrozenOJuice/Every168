import { count } from "drizzle-orm";
import { changed } from "../../shared/errors/revision.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
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
  FoodHistoryQuery,
} from "@168hours/contracts";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import { foods, foodEntries } from "./nutrition.table.js";
export function nutritionRepository(db: Database) {
  const foodOwner = (u: string, id: string) =>
    and(eq(foods.userId, u), eq(foods.id, id));
  const entryOwner = (u: string, id: string) =>
    and(eq(foodEntries.userId, u), eq(foodEntries.id, id));
  return {
    async platformUsage() {
      const foodEntriesCount = (
        await db.select({ total: count() }).from(foodEntries)
      )[0]!.total;
      return { foodEntries: foodEntriesCount };
    },
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
              ? ilike(
                  foods.name,
                  "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%",
                )
              : undefined,
            cursorCondition(q, foods.createdAt, foods.id),
          ),
        )
        .orderBy(desc(foods.createdAt), desc(foods.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async getFood(u: string, id: string, context?: TransactionContext) {
      const query = databaseFor(db, context)
        .select()
        .from(foods)
        .where(foodOwner(u, id));
      return (await (context ? query.for("share") : query))[0];
    },
    async createFood(u: string, v: FoodInput, context?: TransactionContext) {
      return (
        await databaseFor(db, context)
          .insert(foods)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async updateFood(
      u: string,
      id: string,
      v: Partial<FoodInput> & { archivedAt?: Date | null },
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(foods)
          .set({ ...v, updatedAt: new Date() })
          .where(and(foodOwner(u, id), eq(foods.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.getFood(u, id, context));
    },
    async getEntry(u: string, id: string, context?: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select()
          .from(foodEntries)
          .where(entryOwner(u, id))
      )[0];
    },
    async listEntries(
      u: string,
      q: FoodHistoryQuery,
      range?: { startsAt: string; endsAt: string },
    ) {
      const rows = await db
        .select()
        .from(foodEntries)
        .where(
          and(
            eq(foodEntries.userId, u),
            q.search
              ? ilike(
                  foodEntries.nameSnapshot,
                  "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%",
                )
              : undefined,
            range
              ? gte(foodEntries.consumedAt, new Date(range.startsAt))
              : undefined,
            range
              ? lt(foodEntries.consumedAt, new Date(range.endsAt))
              : undefined,
            cursorCondition(q, foodEntries.createdAt, foodEntries.id),
          ),
        )
        .orderBy(desc(foodEntries.createdAt), desc(foodEntries.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async createEntry(
      u: string,
      v: Omit<typeof foodEntries.$inferInsert, "userId">,
      context?: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .insert(foodEntries)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async updateEntry(
      u: string,
      id: string,
      v: FoodEntryUpdate,
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(foodEntries)
          .set({
            ...v,
            consumedAt: new Date(v.consumedAt),
            updatedAt: new Date(),
          })
          .where(and(entryOwner(u, id), eq(foodEntries.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.getEntry(u, id, context));
    },
    async deleteEntry(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .delete(foodEntries)
          .where(and(entryOwner(u, id), eq(foodEntries.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.getEntry(u, id, context));
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
