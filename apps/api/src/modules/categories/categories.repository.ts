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
    async get(userId: string, id: string) {
      return (await db.select().from(categories).where(owned(userId, id)))[0];
    },
    async create(userId: string, input: CategoryInput) {
      return (
        await db
          .insert(categories)
          .values({ userId, ...input })
          .returning()
      )[0]!;
    },
    async update(
      userId: string,
      id: string,
      input: Partial<CategoryInput> & { archivedAt?: Date | null },
    ) {
      return (
        await db
          .update(categories)
          .set({ ...input, updatedAt: new Date() })
          .where(owned(userId, id))
          .returning()
      )[0];
    },
  };
}
