import { randomUUID } from "node:crypto";
import { dayRange, localDate } from "@168hours/domain-utils";
import {
  type CalendarContribution,
  type TaskInput,
  taskInput,
  type TaskQuery,
  type TaskStateInput,
  type ProjectInput,
  type TaskTimeInput,
} from "@168hours/contracts";
import { AppError, found } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type { IdentityService } from "../identity/identity.service.js";
import type {
  PlanningService,
  BlockSourceLink,
} from "../planning/planning.service.js";
import type { tasksRepository } from "./tasks.repository.js";
import { nextTaskDate, shiftTaskDate } from "./tasks.recurrence.js";
function fields(row: TaskInput) {
  return taskInput.parse(
    Object.fromEntries(
      Object.keys(taskInput.shape).map((key) => [
        key,
        row[key as keyof TaskInput],
      ]),
    ),
  );
}
export function tasksService(
  repo: ReturnType<typeof tasksRepository>,
  planning: PlanningService,
  identity: IdentityService,
) {
  async function references(
    u: string,
    v: TaskInput,
    ctx: TransactionContext,
    currentProjectId?: string | null,
  ) {
    if (v.projectId) {
      const project = found(await repo.project(u, v.projectId, ctx));
      if (project.status !== "active" && v.projectId !== currentProjectId)
        throw new AppError(422, "BUSINESS_RULE", "Choose an active project.");
      if (v.sectionId && !project.sections.some((x) => x.id === v.sectionId))
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Choose a section in this project.",
        );
    } else if (v.sectionId)
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Choose a project for this section.",
      );
  }
  async function recurrence(u: string, v: TaskInput) {
    const prefs = await identity.getPreferences(u);
    const date =
      v.dueDate ?? v.plannedDate ?? localDate(new Date(), prefs.timezone);
    if (v.repeat?.until && v.repeat.until < date)
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Repeat through must be on or after the occurrence date.",
      );
    return {
      recurrenceKey: v.repeat ? randomUUID() : null,
      recurrenceAnchor: v.repeat ? date : null,
      occurrenceDate: v.repeat ? date : null,
    };
  }
  async function recordTime(
    u: string,
    taskId: string,
    row: { id: string; startsAt: Date; endsAt: Date },
    ctx: TransactionContext,
  ) {
    const task = found(await repo.get(u, taskId, ctx));
    await planning.recordSource(ctx, u, {
      title: task.title,
      categoryId: null,
      timeBlockId: null,
      sourceType: "task_time",
      sourceId: row.id,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    });
  }
  const service = {
    async list(u: string, q: TaskQuery) {
      let ids: string[] = [];
      if (q.view === "today") {
        const week = await planning.getWeek(u, q.date);
        ids = (
          await repo.links(
            u,
            week.days.find((d) => d.date === q.date)?.blockIds ?? [],
          )
        ).map((x) => x.taskId);
      } else if (q.view === "upcoming") {
        const prefs = await identity.getPreferences(u);
        const start = dayRange(q.date, prefs.timezone).startsAt;
        const schedules = await repo.upcomingSchedules(u);
        const blockIds = schedules.map((s) => s.timeBlockId!);
        const matching = new Set<string>();
        for (let i = 0; i < blockIds.length; i += 100) {
          for (const block of await planning.blocksByIds(
            u,
            blockIds.slice(i, i + 100),
          )) {
            if (new Date(block.endsAt).getTime() > Date.parse(start))
              matching.add(block.id);
          }
        }
        ids = schedules
          .filter((s) => matching.has(s.timeBlockId!))
          .map((s) => s.taskId);
      }
      return repo.list(u, q, ids);
    },
    async get(u: string, id: string) {
      const task = found(await repo.get(u, id));
      const [times, schedules] = await Promise.all([
        repo.times(u, id),
        repo.schedules(u, id),
      ]);
      const blocks = await planning.blocksByIds(
        u,
        schedules.map((x) => x.timeBlockId!),
      );
      return {
        task,
        times,
        schedules: schedules.flatMap((s) => {
          const block = blocks.find((b) => b.id === s.timeBlockId);
          return block
            ? [
                {
                  ...s,
                  ...{
                    title: block.title,
                    startsAt: block.startsAt,
                    endsAt: block.endsAt,
                    blockVersion: block.version,
                  },
                  timeBlockId: block.id,
                },
              ]
            : [];
        }),
      };
    },
    async create(u: string, input: TaskInput, ctx: TransactionContext) {
      await repo.lock(u, ctx);
      const v = taskInput.parse(input);
      await references(u, v, ctx);
      const repeat = await recurrence(u, v);
      return repo.create(
        u,
        {
          ...v,
          ...repeat,
          repeatTemplate: v.repeat
            ? {
                ...v,
                plannedDate:
                  v.plannedDate ?? (!v.dueDate ? repeat.occurrenceDate : null),
              }
            : null,
          plannedDate:
            v.plannedDate ??
            (v.repeat && !v.dueDate ? repeat.occurrenceDate : null),
        },
        ctx,
      );
    },
    async update(
      u: string,
      id: string,
      input: TaskInput,
      version: number,
      ctx: TransactionContext,
      future = false,
    ) {
      await repo.lock(u, ctx);
      const old = assertRevision(await repo.get(u, id, ctx), version);
      const v = taskInput.parse(input);
      await references(u, v, ctx, old.projectId);
      if (future && (!old.recurrenceKey || old.advanced || !old.occurrenceDate))
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Edit future repetition from the current occurrence.",
        );
      if (
        !future &&
        ((v.repeat?.frequency ?? null) !== (old.repeat?.frequency ?? null) ||
          (v.repeat?.until ?? null) !== (old.repeat?.until ?? null)) &&
        old.recurrenceKey
      )
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Use Save future occurrences to change repetition.",
        );
      const repeatMeta = old.recurrenceKey ? null : await recurrence(u, v);
      const effectivePlanned =
        v.plannedDate ??
        (v.repeat && !v.dueDate ? (repeatMeta?.occurrenceDate ?? null) : null);
      const meta = repeatMeta
        ? {
            ...repeatMeta,
            plannedDate: effectivePlanned,
            repeatTemplate: v.repeat
              ? { ...v, plannedDate: effectivePlanned }
              : null,
          }
        : {};
      const baseDate = v.dueDate ?? v.plannedDate ?? old.occurrenceDate;
      const futureMeta = future
        ? {
            repeatTemplate: v.repeat ? v : null,
            ...(baseDate && baseDate !== old.occurrenceDate
              ? { occurrenceDate: baseDate, recurrenceAnchor: baseDate }
              : {}),
          }
        : {};
      const result = await repo.update(
        u,
        id,
        { ...v, ...meta, ...futureMeta },
        version,
        ctx,
      );
      return result;
    },
    async state(
      u: string,
      id: string,
      v: TaskStateInput,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      const old = assertRevision(await repo.get(u, id, ctx), version);
      const status = v.status ?? old.status;
      const terminal = status === "done" || status === "skipped";
      if (status === "skipped" && !old.repeat)
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Only a repeating task can be skipped.",
        );
      const row = await repo.update(
        u,
        id,
        {
          ...v,
          status,
          completedAt: terminal ? (old.completedAt ?? new Date()) : null,
        },
        version,
        ctx,
      );
      if (
        terminal &&
        old.repeat &&
        !old.advanced &&
        old.occurrenceDate &&
        old.recurrenceAnchor
      ) {
        const template = found(old.repeatTemplate ?? undefined);
        const date = nextTaskDate(
          old.occurrenceDate,
          old.recurrenceAnchor,
          old.repeat,
        );
        if (date) {
          await repo.create(
            u,
            {
              ...template,
              status: "todo",
              archived: false,
              completedAt: null,
              inbox: false,
              repeatTemplate: {
                ...template,
                plannedDate: shiftTaskDate(
                  template.plannedDate,
                  old.occurrenceDate,
                  date,
                ),
                dueDate: shiftTaskDate(
                  template.dueDate,
                  old.occurrenceDate,
                  date,
                ),
              },
              recurrenceKey: old.recurrenceKey,
              recurrenceAnchor: old.recurrenceAnchor,
              occurrenceDate: date,
              plannedDate: shiftTaskDate(
                template.plannedDate,
                old.occurrenceDate,
                date,
              ),
              dueDate: shiftTaskDate(
                template.dueDate,
                old.occurrenceDate,
                date,
              ),
              subtasks: template.subtasks.map((s) => ({
                ...s,
                id: randomUUID(),
                completed: false,
              })),
            },
            ctx,
          );
        }
        return repo.update(u, id, { advanced: true }, row.version, ctx);
      }
      return row;
    },
    async duplicate(
      u: string,
      id: string,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      const old = assertRevision(await repo.get(u, id, ctx), version);
      return service.create(
        u,
        {
          ...fields(old),
          title: old.title.slice(0, 153) + " (copy)",
          repeat: null,
          inbox: true,
          subtasks: old.subtasks.map((s) => ({
            ...s,
            id: randomUUID(),
            completed: false,
          })),
        },
        ctx,
      );
    },
    async move(
      u: string,
      id: string,
      direction: "up" | "down",
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      const old = assertRevision(await repo.get(u, id, ctx), version);
      const next = await repo.neighbor(u, old, direction, ctx);
      if (!next) return old;
      await repo.update(
        u,
        next.id,
        { position: old.position },
        next.version,
        ctx,
      );
      return repo.update(u, id, { position: next.position }, old.version, ctx);
    },
    async remove(
      u: string,
      id: string,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      assertRevision(await repo.get(u, id, ctx), version);
      for (const row of await repo.schedules(u, id, ctx)) {
        if (row.timeBlockId) {
          const block = await planning.getBlock(u, row.timeBlockId, ctx);
          await planning.deleteBlock(u, block.id, block.version, ctx);
        }
      }
      for (const row of await repo.times(u, id, ctx))
        await planning.removeSource(ctx, u, "task_time", row.id);
      await repo.remove(u, id, ctx);
      return { ok: true };
    },
    async projects(u: string, cursor?: string) {
      const rows = await repo.projects(u, cursor);
      return {
        items: rows.slice(0, 100),
        nextCursor: rows.length > 100 ? rows[99]!.id : null,
      };
    },
    async project(u: string, id: string) {
      const row = found(await repo.project(u, id));
      return { ...row };
    },
    async createProject(u: string, v: ProjectInput, ctx: TransactionContext) {
      await repo.lock(u, ctx);
      return repo.createProject(u, v, ctx);
    },
    async updateProject(
      u: string,
      id: string,
      v: ProjectInput,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      const old = assertRevision(await repo.project(u, id, ctx), version);
      await repo.clearSections(
        u,
        id,
        old.sections
          .filter((x) => !v.sections.some((s) => s.id === x.id))
          .map((x) => x.id),
        ctx,
      );
      return repo.updateProject(u, id, v, version, ctx);
    },
    async removeProject(
      u: string,
      id: string,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      assertRevision(await repo.project(u, id, ctx), version);
      await repo.removeProject(u, id, ctx);
      return { ok: true };
    },
    async schedule(
      u: string,
      id: string,
      v: TaskTimeInput,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      const task = assertRevision(await repo.get(u, id, ctx), version);
      if (task.archived)
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Restore this task before scheduling.",
        );
      if ((await repo.schedules(u, id, ctx)).length >= 100)
        throw new AppError(
          422,
          "LIMIT_REACHED",
          "A task can have up to 100 scheduled work blocks.",
        );
      const block = await planning.createBlock(
        u,
        {
          title: task.title,
          notes: v.notes,
          categoryId: null,
          goalId: null,
          startsAt: v.startsAt,
          endsAt: v.endsAt,
        },
        ctx,
      );
      const link = await repo.createSchedule(u, id, block.id, ctx);
      await repo.update(u, id, { inbox: false }, version, ctx);
      return { ...link, block };
    },
    async unschedule(
      u: string,
      id: string,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      const link = assertRevision(await repo.schedule(u, id, ctx), version);
      if (link.timeBlockId) {
        const block = await planning.getBlock(u, link.timeBlockId, ctx);
        await planning.deleteBlock(u, block.id, block.version, ctx);
      }
      await repo.removeSchedule(u, id, ctx);
      return { ok: true };
    },
    async logTime(
      u: string,
      id: string,
      v: TaskTimeInput,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      assertRevision(await repo.get(u, id, ctx), version);
      if ((await repo.times(u, id, ctx)).length >= 200)
        throw new AppError(
          422,
          "LIMIT_REACHED",
          "A task can have up to 200 time records.",
        );
      const row = await repo.createTime(u, id, v, ctx);
      await recordTime(u, id, row, ctx);
      return row;
    },
    async updateTime(
      u: string,
      id: string,
      v: TaskTimeInput,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      assertRevision(await repo.time(u, id, ctx), version);
      const row = await repo.updateTime(u, id, v, version, ctx);
      await recordTime(u, row.taskId, row, ctx);
      return row;
    },
    async removeTime(
      u: string,
      id: string,
      version: number,
      ctx: TransactionContext,
    ) {
      await repo.lock(u, ctx);
      assertRevision(await repo.time(u, id, ctx), version);
      await planning.removeSource(ctx, u, "task_time", id);
      await repo.removeTime(u, id, ctx);
      return { ok: true };
    },
    forBlock: repo.forBlock,
    async forTime(u: string, id: string) {
      return { taskId: found(await repo.time(u, id)).taskId };
    },
    capturePlanLinks: repo.capture,
    async restorePlanLinks(
      u: string,
      id: string,
      links: BlockSourceLink[],
      ctx: TransactionContext,
    ) {
      for (const link of links.filter((x) => x.kind === "task-schedule")) {
        if (!(await repo.restore(u, id, link, ctx)))
          throw new AppError(
            409,
            "UNDO_CONFLICT",
            "This task's schedule changed after deletion.",
          );
      }
    },
    async dayLinks(u: string, date: string) {
      const week = await planning.getWeek(u, date);
      return {
        blockIds: (
          await repo.links(
            u,
            week.days.find((d) => d.date === date)?.blockIds ?? [],
          )
        ).map((s) => s.timeBlockId!),
      };
    },
    async calendarActivity(
      u: string,
      range: { startsAt: string; endsAt: string; timezone: string },
    ): Promise<CalendarContribution> {
      const from = localDate(range.startsAt, range.timezone),
        to = localDate(new Date(Date.parse(range.endsAt) - 1), range.timezone);
      const rows = await repo.activity(
        u,
        range.startsAt,
        range.endsAt,
        from,
        to,
      );
      const entries: CalendarContribution["entries"] = [];
      for (const task of rows.dated.slice(0, 200)) {
        const dates = [
          ...new Set(
            [task.plannedDate, task.dueDate].filter(
              (d): d is string => !!d && d >= from && d <= to,
            ),
          ),
        ];
        for (const date of dates)
          entries.push({
            source: { type: "task", id: task.id },
            domain: "Tasks",
            icon: "check",
            kind: "task",
            status: "planned",
            title: task.title,
            summary: [
              task.plannedDate === date ? "Planned for this day" : null,
              task.dueDate === date ? "Due this day" : null,
            ]
              .filter(Boolean)
              .join(" · "),
            occurredAt: dayRange(date, range.timezone).startsAt,
            endsAt: null,
            href: `/tasks?task=${task.id}&date=${date}`,
          });
      }
      for (const { log, task } of rows.times.slice(0, 200))
        entries.push({
          source: { type: "task_time", id: log.id },
          domain: "Tasks",
          icon: "check",
          kind: "session",
          status: "recorded",
          title: task.title,
          summary: log.notes ?? "Recorded work",
          occurredAt: log.startsAt.toISOString(),
          endsAt: log.endsAt.toISOString(),
          href: `/tasks?task=${task.id}`,
        });
      for (const task of rows.completed.slice(0, 200))
        entries.push({
          source: { type: "task_completion", id: task.id },
          domain: "Tasks",
          icon: "check",
          kind: "moment",
          status: "recorded",
          title: task.title,
          summary:
            task.status === "skipped" ? "Skipped occurrence" : "Completed task",
          occurredAt: task.completedAt!.toISOString(),
          endsAt: null,
          href: `/tasks?task=${task.id}`,
        });
      return {
        label: "Tasks",
        href: "/tasks?view=all&status=all",
        truncated: Object.values(rows).some((v) => v.length > 200),
        entries,
      };
    },
  };
  return service;
}
export type TasksService = ReturnType<typeof tasksService>;
