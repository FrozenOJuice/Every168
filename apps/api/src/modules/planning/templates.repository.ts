import { and, eq, gte, lt, desc } from "drizzle-orm";
import type {
  PageQuery,
  TemplateCaptureInput,
  TemplateEntry,
} from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import {
  databaseFor,
  transactionRunner,
} from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import {
  calendarTemplates as t,
  calendarTemplateEntries as e,
  calendarItems,
} from "./calendar.table.js";
import { timeBlocks } from "./planning.table.js";
export function templatesRepository(db: Database) {
  const owned = (u: string, id: string) => and(eq(t.userId, u), eq(t.id, id));
  return {
    async get(u: string, id: string, ctx?: TransactionContext) {
      return transactionRunner(db)(async (tx) => {
        const parent = (
          await databaseFor(db, tx)
            .select()
            .from(t)
            .where(owned(u, id))
            .for("share")
        )[0];
        if (!parent) return undefined;
        const entries = await databaseFor(db, tx)
          .select()
          .from(e)
          .where(and(eq(e.userId, u), eq(e.templateId, id)))
          .orderBy(e.dayOffset, e.startMinute, e.id);
        return { ...parent, entries };
      }, ctx);
    },
    async list(u: string, q: PageQuery) {
      const rows = await db
        .select()
        .from(t)
        .where(and(eq(t.userId, u), cursorCondition(q, t.createdAt, t.id)))
        .orderBy(desc(t.createdAt), desc(t.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async source(
      u: string,
      start: string,
      end: string,
      from: string,
      to: string,
      ctx?: TransactionContext,
    ) {
      return transactionRunner(db)(async (scope) => {
        const tx = databaseFor(db, scope);
        const blocks = await tx
          .select()
          .from(timeBlocks)
          .where(
            and(
              eq(timeBlocks.userId, u),
              gte(timeBlocks.startsAt, new Date(start)),
              lt(timeBlocks.startsAt, new Date(end)),
            ),
          )
          .orderBy(timeBlocks.startsAt, timeBlocks.id)
          .limit(101)
          .for("share");
        const items = await tx
          .select()
          .from(calendarItems)
          .where(
            and(
              eq(calendarItems.userId, u),
              gte(calendarItems.date, from),
              lt(calendarItems.date, to),
            ),
          )
          .orderBy(calendarItems.date, calendarItems.id)
          .limit(101)
          .for("share");
        return { blocks, items };
      }, ctx);
    },
    async create(
      u: string,
      v: TemplateCaptureInput,
      entries: TemplateEntry[],
      ctx: TransactionContext,
    ) {
      const parent = (
        await databaseFor(db, ctx)
          .insert(t)
          .values({ userId: u, name: v.name, span: v.span })
          .returning()
      )[0]!;
      if (entries.length)
        await databaseFor(db, ctx)
          .insert(e)
          .values(
            entries.map((entry) => ({
              ...entry,
              userId: u,
              templateId: parent.id,
            })),
          );
      return (await this.get(u, parent.id, ctx))!;
    },
    async rename(
      u: string,
      id: string,
      name: string,
      version: number,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .update(t)
          .set({ name })
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
    },
    async remove(
      u: string,
      id: string,
      version: number,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .delete(t)
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
    },
  };
}
