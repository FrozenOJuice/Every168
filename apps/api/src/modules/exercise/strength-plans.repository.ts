import { AppError } from "../../shared/errors/app-error.js";
import { and, eq, desc } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type { StrengthPlanQuery } from "@168hours/contracts";
import { strengthPlans as plans } from "./exercise.table.js";

type Values = typeof plans.$inferInsert;
export function strengthPlansRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(plans.userId, u), eq(plans.id, id));
  return {
    async capturePlanLinks(u: string, id: string, context: TransactionContext) {
      const rows = await databaseFor(db, context)
        .select()
        .from(plans)
        .where(and(eq(plans.userId, u), eq(plans.timeBlockId, id)))
        .for("update");
      return rows.map((row) => ({
        kind: "strength-plan" as const,
        id: row.id,
        version: row.version + 1,
      }));
    },
    async restorePlanLink(
      u: string,
      blockId: string,
      link: { id: string; version: number },
      context: TransactionContext,
    ) {
      const tx = databaseFor(db, context);
      const row = (
        await tx.select().from(plans).where(owned(u, link.id)).for("update")
      )[0];
      if (!row || row.version !== link.version || row.timeBlockId !== null)
        throw new AppError(
          409,
          "UNDO_CONFLICT",
          "Scheduled workout changed since Calendar deletion.",
        );
      await tx
        .update(plans)
        .set({ timeBlockId: blockId })
        .where(owned(u, link.id));
    },
    async list(u: string, q: StrengthPlanQuery) {
      const rows = await db
        .select()
        .from(plans)
        .where(
          and(
            eq(plans.userId, u),
            eq(plans.kind, q.kind),
            cursorCondition(q, plans.createdAt, plans.id),
          ),
        )
        .orderBy(desc(plans.createdAt), desc(plans.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async get(u: string, id: string, context?: TransactionContext) {
      const query = databaseFor(db, context)
        .select()
        .from(plans)
        .where(owned(u, id));
      return (await (context ? query.for("update") : query))[0];
    },
    async forBlock(u: string, id: string) {
      return (
        (
          await db
            .select()
            .from(plans)
            .where(and(eq(plans.userId, u), eq(plans.timeBlockId, id)))
        )[0] ?? null
      );
    },
    async create(
      u: string,
      v: Omit<Values, "userId">,
      context: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .insert(plans)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      v: Partial<Pick<Values, "title" | "notes" | "exercises" | "sessionId">>,
      context: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .update(plans)
          .set(v)
          .where(owned(u, id))
          .returning()
      )[0]!;
    },
    async remove(u: string, id: string, context: TransactionContext) {
      return (
        await databaseFor(db, context)
          .delete(plans)
          .where(owned(u, id))
          .returning()
      )[0];
    },
  };
}
