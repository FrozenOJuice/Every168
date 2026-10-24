import {
  and,
  asc,
  eq,
  gt,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import type { TaskQuery } from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { changed } from "../../shared/errors/revision.js";
import {
  tasks as t,
  taskProjects as p,
  taskSchedules as s,
  taskTimes as l,
} from "./tasks.table.js";
const cursorSchema = z.object({ position: z.number().finite(), id: z.uuid() });
export function tasksRepository(db: Database) {
  const owned = (u: string, id: string) => and(eq(t.userId, u), eq(t.id, id));
  const projectOwned = (u: string, id: string) =>
    and(eq(p.userId, u), eq(p.id, id));
  return {
    async lock(u: string, ctx: TransactionContext) {
      await databaseFor(db, ctx).execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"tasks:" + u},0))`,
      );
    },
    async get(u: string, id: string, ctx?: TransactionContext) {
      return (
        await databaseFor(db, ctx).select().from(t).where(owned(u, id))
      )[0];
    },
    async list(u: string, q: TaskQuery, dayTaskIds: string[]) {
      let cursor: z.infer<typeof cursorSchema> | undefined;
      if (q.cursor) {
        let value: unknown;
        try {
          value = JSON.parse(Buffer.from(q.cursor, "base64url").toString());
        } catch {
          value = null;
        }
        cursor = cursorSchema.parse(value);
      }
      const active = or(eq(t.status, "todo"), eq(t.status, "in_progress"));
      const rows = await db
        .select()
        .from(t)
        .where(
          and(
            eq(t.userId, u),
            eq(t.archived, q.archived === "true"),
            q.status === "active"
              ? active
              : q.status === "all"
                ? undefined
                : eq(t.status, q.status),
            q.projectId ? eq(t.projectId, q.projectId) : undefined,
            q.priority ? eq(t.priority, q.priority) : undefined,
            q.tag ? sql`${q.tag}=any(${t.tags})` : undefined,
            q.q
              ? sql`strpos(lower(${t.title}||' '||coalesce(${t.notes},'')||' '||array_to_string(${t.tags},' ')),lower(${q.q}))>0`
              : undefined,
            q.view === "inbox"
              ? eq(t.inbox, true)
              : q.view === "today"
                ? or(
                    sql`${t.dueDate}<=${q.date}::date`,
                    sql`${t.plannedDate}<=${q.date}::date`,
                    dayTaskIds.length ? inArray(t.id, dayTaskIds) : undefined,
                  )
                : q.view === "upcoming"
                  ? or(
                      sql`${t.dueDate}>=${q.date}::date`,
                      sql`${t.plannedDate}>=${q.date}::date`,
                      dayTaskIds.length ? inArray(t.id, dayTaskIds) : undefined,
                    )
                  : undefined,
            cursor
              ? or(
                  gt(t.position, cursor.position),
                  and(eq(t.position, cursor.position), gt(t.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(asc(t.position), asc(t.id))
        .limit(q.limit + 1);
      const items = rows.slice(0, q.limit),
        last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > q.limit && last
            ? Buffer.from(
                JSON.stringify({ position: last.position, id: last.id }),
              ).toString("base64url")
            : null,
      };
    },
    async create(
      u: string,
      v: Omit<typeof t.$inferInsert, "userId" | "position">,
      ctx: TransactionContext,
    ) {
      const tx = databaseFor(db, ctx);
      const [row] = await tx
        .select({ position: sql<number>`coalesce(max(${t.position}),0)+1024` })
        .from(t)
        .where(eq(t.userId, u));
      return (
        await tx
          .insert(t)
          .values({ ...v, userId: u, position: row!.position })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      v: Partial<Omit<typeof t.$inferInsert, "userId" | "id">>,
      version: number,
      ctx: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, ctx)
          .update(t)
          .set({ ...v, updatedAt: new Date() })
          .where(and(owned(u, id), eq(t.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, ctx));
    },
    async remove(u: string, id: string, ctx: TransactionContext) {
      await databaseFor(db, ctx).delete(t).where(owned(u, id));
    },
    async neighbor(
      u: string,
      row: typeof t.$inferSelect,
      direction: "up" | "down",
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .select()
          .from(t)
          .where(
            and(
              eq(t.userId, u),
              row.projectId
                ? eq(t.projectId, row.projectId)
                : isNull(t.projectId),
              row.sectionId
                ? eq(t.sectionId, row.sectionId)
                : isNull(t.sectionId),
              eq(t.archived, false),
              inArray(t.status, ["todo", "in_progress"]),
              direction === "up"
                ? lt(t.position, row.position)
                : gt(t.position, row.position),
            ),
          )
          .orderBy(
            direction === "up" ? sql`${t.position} desc` : asc(t.position),
          )
          .limit(1)
      )[0];
    },
    async project(u: string, id: string, ctx?: TransactionContext) {
      return (
        await databaseFor(db, ctx).select().from(p).where(projectOwned(u, id))
      )[0];
    },
    async projects(u: string, cursor?: string) {
      return db
        .select({
          ...getTableColumns(p),
          taskCount: sql<number>`(select count(*)::int from tasks where user_id=${u} and project_id="task_projects"."id" and not archived)`,
          completedCount: sql<number>`(select count(*)::int from tasks where user_id=${u} and project_id="task_projects"."id" and not archived and status='done')`,
        })
        .from(p)
        .where(
          and(
            eq(p.userId, u),
            cursor ? gt(p.id, z.uuid().parse(cursor)) : undefined,
          ),
        )
        .orderBy(asc(p.id))
        .limit(101);
    },
    async createProject(
      u: string,
      v: Omit<typeof p.$inferInsert, "userId">,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .insert(p)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async updateProject(
      u: string,
      id: string,
      v: Partial<typeof p.$inferInsert>,
      version: number,
      ctx: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, ctx)
          .update(p)
          .set(v)
          .where(and(projectOwned(u, id), eq(p.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.project(u, id, ctx));
    },
    async clearSections(
      u: string,
      id: string,
      ids: string[],
      ctx: TransactionContext,
    ) {
      if (!ids.length) return;
      const current = and(eq(t.projectId, id), inArray(t.sectionId, ids));
      const template = and(
        sql`${t.repeatTemplate}->>'projectId'=${id}`,
        inArray(sql<string>`${t.repeatTemplate}->>'sectionId'`, ids),
      );
      await databaseFor(db, ctx)
        .update(t)
        .set({
          sectionId: sql`case when ${current} then null else ${t.sectionId} end`,
          repeatTemplate: sql`case when ${template} then jsonb_set(${t.repeatTemplate},'{sectionId}','null'::jsonb) else ${t.repeatTemplate} end`,
        })
        .where(and(eq(t.userId, u), or(current, template)));
    },
    async removeProject(u: string, id: string, ctx: TransactionContext) {
      const tx = databaseFor(db, ctx);
      const current = eq(t.projectId, id);
      const template = sql`${t.repeatTemplate}->>'projectId'=${id}`;
      await tx
        .update(t)
        .set({
          projectId: sql`case when ${current} then null else ${t.projectId} end`,
          sectionId: sql`case when ${current} then null else ${t.sectionId} end`,
          repeatTemplate: sql`case when ${template} then jsonb_set(jsonb_set(${t.repeatTemplate},'{projectId}','null'::jsonb),'{sectionId}','null'::jsonb) else ${t.repeatTemplate} end`,
        })
        .where(and(eq(t.userId, u), or(current, template)));
      await tx.delete(p).where(projectOwned(u, id));
    },
    async upcomingSchedules(u: string) {
      return db
        .select(getTableColumns(s))
        .from(s)
        .innerJoin(t, and(eq(s.taskId, t.id), eq(s.userId, t.userId)))
        .where(
          and(
            eq(s.userId, u),
            isNotNull(s.timeBlockId),
            eq(t.archived, false),
            inArray(t.status, ["todo", "in_progress"]),
          ),
        );
    },
    async schedules(u: string, taskId?: string, ctx?: TransactionContext) {
      return databaseFor(db, ctx)
        .select()
        .from(s)
        .where(
          and(
            eq(s.userId, u),
            taskId ? eq(s.taskId, taskId) : undefined,
            isNotNull(s.timeBlockId),
          ),
        )
        .orderBy(asc(s.createdAt));
    },
    async links(u: string, ids: string[]) {
      return ids.length
        ? db
            .select()
            .from(s)
            .where(and(eq(s.userId, u), inArray(s.timeBlockId, ids)))
        : [];
    },
    async schedule(u: string, id: string, ctx: TransactionContext) {
      return (
        await databaseFor(db, ctx)
          .select()
          .from(s)
          .where(and(eq(s.userId, u), eq(s.id, id)))
      )[0];
    },
    async createSchedule(
      u: string,
      taskId: string,
      timeBlockId: string,
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .insert(s)
          .values({ userId: u, taskId, timeBlockId })
          .returning()
      )[0]!;
    },
    async removeSchedule(u: string, id: string, ctx: TransactionContext) {
      await databaseFor(db, ctx)
        .delete(s)
        .where(and(eq(s.userId, u), eq(s.id, id)));
    },
    async capture(u: string, blockId: string, ctx: TransactionContext) {
      const rows = await databaseFor(db, ctx)
        .select()
        .from(s)
        .where(and(eq(s.userId, u), eq(s.timeBlockId, blockId)))
        .for("update");
      return rows.map((row) => ({
        kind: "task-schedule" as const,
        id: row.id,
        version: row.version + 1,
      }));
    },
    async restore(
      u: string,
      blockId: string,
      link: { id: string; version: number },
      ctx: TransactionContext,
    ) {
      const row = await this.schedule(u, link.id, ctx);
      if (!row || row.version !== link.version || row.timeBlockId !== null)
        return false;
      await databaseFor(db, ctx)
        .update(s)
        .set({ timeBlockId: blockId })
        .where(and(eq(s.userId, u), eq(s.id, row.id)));
      return true;
    },
    async forBlock(u: string, blockId: string) {
      const rows = await db
        .select({ taskId: s.taskId })
        .from(s)
        .where(and(eq(s.userId, u), eq(s.timeBlockId, blockId)));
      return rows[0]?.taskId ?? null;
    },
    async times(u: string, taskId: string, ctx?: TransactionContext) {
      return databaseFor(db, ctx)
        .select()
        .from(l)
        .where(and(eq(l.userId, u), eq(l.taskId, taskId)))
        .orderBy(asc(l.startsAt))
        .limit(201);
    },
    async time(u: string, id: string, ctx?: TransactionContext) {
      return (
        await databaseFor(db, ctx)
          .select()
          .from(l)
          .where(and(eq(l.userId, u), eq(l.id, id)))
      )[0];
    },
    async createTime(
      u: string,
      taskId: string,
      v: { startsAt: string; endsAt: string; notes: string | null },
      ctx: TransactionContext,
    ) {
      return (
        await databaseFor(db, ctx)
          .insert(l)
          .values({
            ...v,
            userId: u,
            taskId,
            startsAt: new Date(v.startsAt),
            endsAt: new Date(v.endsAt),
          })
          .returning()
      )[0]!;
    },
    async updateTime(
      u: string,
      id: string,
      v: { startsAt: string; endsAt: string; notes: string | null },
      version: number,
      ctx: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, ctx)
          .update(l)
          .set({
            ...v,
            startsAt: new Date(v.startsAt),
            endsAt: new Date(v.endsAt),
          })
          .where(and(eq(l.userId, u), eq(l.id, id), eq(l.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.time(u, id, ctx));
    },
    async removeTime(u: string, id: string, ctx: TransactionContext) {
      await databaseFor(db, ctx)
        .delete(l)
        .where(and(eq(l.userId, u), eq(l.id, id)));
    },
    async activity(
      u: string,
      from: string,
      to: string,
      fromDate: string,
      toDate: string,
    ) {
      const [dated, times, completed] = await Promise.all([
        db
          .select()
          .from(t)
          .where(
            and(
              eq(t.userId, u),
              eq(t.archived, false),
              inArray(t.status, ["todo", "in_progress"]),
              or(
                sql`${t.plannedDate} between ${fromDate}::date and ${toDate}::date`,
                sql`${t.dueDate} between ${fromDate}::date and ${toDate}::date`,
              ),
            ),
          )
          .orderBy(asc(t.id))
          .limit(201),
        db
          .select({ log: l, task: t })
          .from(l)
          .innerJoin(t, and(eq(l.taskId, t.id), eq(l.userId, t.userId)))
          .where(
            and(
              eq(l.userId, u),
              lt(l.startsAt, new Date(to)),
              gt(l.endsAt, new Date(from)),
            ),
          )
          .orderBy(asc(l.startsAt), asc(l.id))
          .limit(201),
        db
          .select()
          .from(t)
          .where(
            and(
              eq(t.userId, u),
              isNotNull(t.completedAt),
              sql`${t.completedAt}>=${new Date(from)}`,
              lt(t.completedAt, new Date(to)),
            ),
          )
          .orderBy(asc(t.completedAt), asc(t.id))
          .limit(201),
      ]);
      return { dated, times, completed };
    },
  };
}
