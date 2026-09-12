import { changed } from "../../shared/errors/revision.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { and, eq, asc } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import type { CategoryInput } from "@168hours/contracts";
import { categories } from "./categories.table.js";
export function categoriesRepository(db: Database) {
  const owned = (userId: string, id: string) =>
    and(eq(categories.userId, userId), eq(categories.id, id));
  return {
    list: (userId: string) =>
      db
        .select()
        .from(categories)
        .where(eq(categories.userId, userId))
        .orderBy(asc(categories.name), asc(categories.id)),
    async get(userId: string, id: string, context?: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select()
          .from(categories)
          .where(owned(userId, id))
      )[0];
    },
    async create(
      userId: string,
      input: CategoryInput,
      context?: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .insert(categories)
          .values({ ...input, userId })
          .returning()
      )[0]!;
    },
    async update(
      userId: string,
      id: string,
      input: Partial<CategoryInput> & { archivedAt?: Date | null },
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(categories)
          .set({ ...input, updatedAt: new Date() })
          .where(and(owned(userId, id), eq(categories.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(userId, id, context));
    },
  };
}
