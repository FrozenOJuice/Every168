import {
  and,
  eq,
  desc,
  gte,
  lt,
  lte,
  isNull,
  ilike,
  sql,
  type SQLWrapper,
} from "drizzle-orm";
import { z } from "zod";
import type { CalendarSearchQuery } from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { AppError } from "../../shared/errors/app-error.js";
import { calendarItems } from "./calendar.table.js";
import { timeBlocks, timeEntries } from "./planning.table.js";
const cursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  kind: z.enum(["block", "entry", "item"]),
});
export function calendarSearchRepository(db: Database) {
  return {
    async search(
      u: string,
      q: CalendarSearchQuery,
      from?: string,
      to?: string,
      includeUnscheduled = true,
    ) {
      let cursor: z.infer<typeof cursorSchema> | undefined;
      if (q.cursor)
        try {
          cursor = cursorSchema.parse(
            JSON.parse(Buffer.from(q.cursor, "base64url").toString()),
          );
        } catch {
          throw new AppError(422, "VALIDATION_ERROR", "Invalid search cursor.");
        }
      const after = (created: SQLWrapper, id: SQLWrapper, kind: string) =>
        cursor
          ? sql`(${created},${id},${kind}::text)<(${new Date(cursor.createdAt)},${cursor.id}::uuid,${cursor.kind}::text)`
          : undefined;
      const pattern = "%" + q.q.replace(/[\\%_]/g, "\\$&") + "%";
      return db.transaction(
        async (tx) => {
          const b = timeBlocks,
            e = timeEntries,
            i = calendarItems;
          const blocks =
            q.kind === "all" || q.kind === "block"
              ? await tx
                  .select()
                  .from(b)
                  .where(
                    and(
                      eq(b.userId, u),
                      ilike(b.title, pattern),
                      q.categoryId
                        ? q.categoryId === "none"
                          ? isNull(b.categoryId)
                          : eq(b.categoryId, q.categoryId)
                        : undefined,
                      from ? gte(b.startsAt, new Date(from)) : undefined,
                      to ? lt(b.startsAt, new Date(to)) : undefined,
                      after(b.createdAt, b.id, "block"),
                    ),
                  )
                  .orderBy(desc(b.createdAt), desc(b.id))
                  .limit(q.limit + 1)
              : [];
          const entries =
            q.kind === "all" || q.kind === "entry"
              ? await tx
                  .select()
                  .from(e)
                  .where(
                    and(
                      eq(e.userId, u),
                      ilike(e.title, pattern),
                      q.categoryId
                        ? q.categoryId === "none"
                          ? isNull(e.categoryId)
                          : eq(e.categoryId, q.categoryId)
                        : undefined,
                      from ? gte(e.startsAt, new Date(from)) : undefined,
                      to ? lt(e.startsAt, new Date(to)) : undefined,
                      after(e.createdAt, e.id, "entry"),
                    ),
                  )
                  .orderBy(desc(e.createdAt), desc(e.id))
                  .limit(q.limit + 1)
              : [];
          const items =
            q.kind === "all" || q.kind === "all_day" || q.kind === "unscheduled"
              ? await tx
                  .select()
                  .from(i)
                  .where(
                    and(
                      eq(i.userId, u),
                      ilike(i.title, pattern),
                      q.kind !== "all"
                        ? eq(i.kind, q.kind)
                        : includeUnscheduled
                          ? undefined
                          : eq(i.kind, "all_day"),
                      q.categoryId
                        ? q.categoryId === "none"
                          ? isNull(i.categoryId)
                          : eq(i.categoryId, q.categoryId)
                        : undefined,
                      q.from ? gte(i.date, q.from) : undefined,
                      q.to ? lte(i.date, q.to) : undefined,
                      after(i.createdAt, i.id, "item"),
                    ),
                  )
                  .orderBy(desc(i.createdAt), desc(i.id))
                  .limit(q.limit + 1)
              : [];
          const all = [
            ...blocks.map((item) => ({ kind: "block" as const, item })),
            ...entries.map((item) => ({ kind: "entry" as const, item })),
            ...items.map((item) => ({ kind: "item" as const, item })),
          ].sort(
            (a, b) =>
              b.item.createdAt.getTime() - a.item.createdAt.getTime() ||
              (a.item.id < b.item.id
                ? 1
                : a.item.id > b.item.id
                  ? -1
                  : a.kind < b.kind
                    ? 1
                    : a.kind > b.kind
                      ? -1
                      : 0),
          );
          const result = all.slice(0, q.limit),
            last = result.at(-1);
          return {
            items: result,
            nextCursor:
              all.length > q.limit && last
                ? Buffer.from(
                    JSON.stringify({
                      createdAt: last.item.createdAt.toISOString(),
                      id: last.item.id,
                      kind: last.kind,
                    }),
                  ).toString("base64url")
                : null,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
