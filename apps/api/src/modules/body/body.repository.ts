import { changed } from "../../shared/errors/revision.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { and, eq, desc } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import type { WeightInput, PageQuery } from "@168hours/contracts";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import { weightEntries as table } from "./body.table.js";
export function bodyRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(table.userId, u), eq(table.id, id));
  return {
    async list(u: string, q: PageQuery) {
      const rows = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.userId, u),
            cursorCondition(q, table.createdAt, table.id),
          ),
        )
        .orderBy(desc(table.createdAt), desc(table.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async get(u: string, id: string, context?: TransactionContext) {
      return (
        await databaseFor(db, context).select().from(table).where(owned(u, id))
      )[0];
    },
    async create(u: string, v: WeightInput, context?: TransactionContext) {
      return (
        await databaseFor(db, context)
          .insert(table)
          .values({ ...v, userId: u, measuredAt: new Date(v.measuredAt) })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      v: WeightInput,
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(table)
          .set({
            ...v,
            measuredAt: new Date(v.measuredAt),
            updatedAt: new Date(),
          })
          .where(and(owned(u, id), eq(table.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, context));
    },
    async remove(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .delete(table)
          .where(and(owned(u, id), eq(table.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, context));
    },
    async latest(u: string) {
      return (
        (
          await db
            .select()
            .from(table)
            .where(eq(table.userId, u))
            .orderBy(desc(table.measuredAt), desc(table.id))
            .limit(1)
        )[0] ?? null
      );
    },
  };
}
