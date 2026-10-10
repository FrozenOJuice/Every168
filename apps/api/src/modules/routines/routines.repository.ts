import { and, desc, eq, sql } from "drizzle-orm";
import type { RoutineInput } from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { changed } from "../../shared/errors/revision.js";
import { routines as t } from "./routines.table.js";

export function routinesRepository(db: Database) {
  const owned = (u: string, id: string) => and(eq(t.userId, u), eq(t.id, id));
  return {
    list(u: string) {
      return db
        .select()
        .from(t)
        .where(eq(t.userId, u))
        .orderBy(desc(t.createdAt), desc(t.id));
    },
    async get(u: string, id: string, ctx?: TransactionContext) {
      return (
        await databaseFor(db, ctx).select().from(t).where(owned(u, id))
      )[0];
    },
    async create(u: string, input: RoutineInput, ctx?: TransactionContext) {
      return (
        await databaseFor(db, ctx)
          .insert(t)
          .values({ ...input, userId: u })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      input: RoutineInput,
      version: number,
      ctx?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, ctx)
          .update(t)
          .set({ ...input, checked: [], updatedAt: new Date() })
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, ctx));
    },
    async progress(
      u: string,
      id: string,
      checked: number[],
      version: number,
      ctx?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, ctx)
          .update(t)
          .set({ checked, updatedAt: new Date() })
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, ctx));
    },
    async complete(
      u: string,
      id: string,
      version: number,
      ctx?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, ctx)
          .update(t)
          .set({
            checked: [],
            runCount: sql`${t.runCount}+1`,
            lastCompletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, ctx));
    },
    async remove(
      u: string,
      id: string,
      version: number,
      ctx?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, ctx)
          .delete(t)
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, ctx));
    },
  };
}
