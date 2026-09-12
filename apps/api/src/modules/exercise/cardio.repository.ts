import { and, eq, desc } from "drizzle-orm";
import type {
  Db,
  Database,
  Transaction,
} from "../../infrastructure/database/client.js";
import type { CardioInput, PageQuery } from "@168hours/contracts";
import { cursorCondition, pageResult } from "../../shared/http/pagination.js";
import { cardioActivities as table } from "./exercise.table.js";
export function cardioRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(table.userId, u), eq(table.id, id));
  return {
    async get(u: string, id: string, tx: Db = db, lock = false) {
      const q = tx.select().from(table).where(owned(u, id));
      return (await (lock ? q.for("update") : q))[0];
    },
    async create(tx: Transaction, u: string, v: CardioInput) {
      return (
        await tx
          .insert(table)
          .values({ ...v, userId: u, startedAt: new Date(v.startedAt) })
          .returning()
      )[0]!;
    },
    async update(tx: Transaction, u: string, id: string, v: CardioInput) {
      return (
        await tx
          .update(table)
          .set({
            ...v,
            startedAt: new Date(v.startedAt),
            updatedAt: new Date(),
          })
          .where(owned(u, id))
          .returning()
      )[0];
    },
    async remove(tx: Transaction, u: string, id: string) {
      return (await tx.delete(table).where(owned(u, id)).returning())[0];
    },
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
    async latest(u: string) {
      return (
        (
          await db
            .select()
            .from(table)
            .where(eq(table.userId, u))
            .orderBy(desc(table.startedAt), desc(table.id))
            .limit(1)
        )[0] ?? null
      );
    },
  };
}
