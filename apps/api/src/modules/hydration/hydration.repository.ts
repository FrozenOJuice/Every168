import { and, eq, desc, gte, lt, sql } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import type { WaterInput, PageQuery } from "@168hours/contracts";
import { cursorCondition, pageResult } from "../../shared/http/pagination.js";
import { waterEntries as table } from "./hydration.table.js";
export function hydrationRepository(db: Database) {
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
    async get(u: string, id: string) {
      return (await db.select().from(table).where(owned(u, id)))[0];
    },
    async create(u: string, v: WaterInput) {
      return (
        await db
          .insert(table)
          .values({ ...v, userId: u, consumedAt: new Date(v.consumedAt) })
          .returning()
      )[0]!;
    },
    async update(u: string, id: string, v: WaterInput) {
      return (
        await db
          .update(table)
          .set({
            ...v,
            consumedAt: new Date(v.consumedAt),
            updatedAt: new Date(),
          })
          .where(owned(u, id))
          .returning()
      )[0];
    },
    async remove(u: string, id: string) {
      return (await db.delete(table).where(owned(u, id)).returning())[0];
    },
    async latest(u: string) {
      return (
        (
          await db
            .select()
            .from(table)
            .where(eq(table.userId, u))
            .orderBy(desc(table.consumedAt), desc(table.id))
            .limit(1)
        )[0] ?? null
      );
    },
    async daily(u: string, start: string, end: string) {
      return (
        await db
          .select({
            total: sql<number | null>`sum(${table.amountMl})`.mapWith(Number),
            count: sql<number>`count(*)::int`,
          })
          .from(table)
          .where(
            and(
              eq(table.userId, u),
              gte(table.consumedAt, new Date(start)),
              lt(table.consumedAt, new Date(end)),
            ),
          )
      )[0]!;
    },
  };
}
