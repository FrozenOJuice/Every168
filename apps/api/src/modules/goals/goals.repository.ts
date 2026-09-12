import { and, eq, desc } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import { cursorCondition, pageResult } from "../../shared/http/pagination.js";
import type { GoalInput, GoalsQuery } from "@168hours/contracts";
import { goals } from "./goals.table.js";
export function goalsRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(goals.userId, u), eq(goals.id, id));
  return {
    async get(u: string, id: string) {
      return (await db.select().from(goals).where(owned(u, id)))[0];
    },
    async list(u: string, q: GoalsQuery) {
      const rows = await db
        .select()
        .from(goals)
        .where(
          and(
            eq(goals.userId, u),
            q.status ? eq(goals.status, q.status) : undefined,
            cursorCondition(q, goals.createdAt, goals.id),
          ),
        )
        .orderBy(desc(goals.createdAt), desc(goals.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async create(u: string, v: GoalInput, completedAt: Date | null) {
      return (
        await db
          .insert(goals)
          .values({ ...v, userId: u, completedAt })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      v: GoalInput,
      completedAt: Date | null,
    ) {
      return (
        await db
          .update(goals)
          .set({ ...v, completedAt, updatedAt: new Date() })
          .where(owned(u, id))
          .returning()
      )[0];
    },
  };
}
