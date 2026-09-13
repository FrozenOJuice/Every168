import { createHash } from "node:crypto";
import {
  copyInput,
  templateCaptureInput,
  type CopyInput,
  type CopyPreview,
  type TemplateCaptureInput,
  type TemplateEntry,
  type PageQuery,
} from "@168hours/contracts";
import {
  addDays,
  dayRange,
  daysBetween,
  localDate,
  localMinute,
  plannedInstant,
  weekRange,
} from "@168hours/domain-utils";
import type { IdentityService } from "../identity/identity.service.js";
import type { PlanningService } from "./planning.service.js";
import type { CalendarItemsService } from "./calendar-items.service.js";
import type { templatesRepository } from "./templates.repository.js";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import { AppError, found } from "../../shared/errors/app-error.js";
import {
  assertRevision,
  changed,
  staleRevision,
} from "../../shared/errors/revision.js";

export function templatesService(
  repo: ReturnType<typeof templatesRepository>,
  identity: IdentityService,
  planning: PlanningService,
  items: CalendarItemsService,
  transaction: RunInTransaction,
) {
  async function source(
    u: string,
    date: string,
    span: "day" | "week",
    ctx?: TransactionContext,
  ) {
    const prefs = await identity.getPreferences(u, ctx);
    const from =
      span === "week"
        ? weekRange(date, prefs.timezone, prefs.weekStartsOn).weekStart
        : date;
    const to = addDays(from, span === "week" ? 7 : 1);
    const rows = await repo.source(
      u,
      dayRange(from, prefs.timezone).startsAt,
      dayRange(to, prefs.timezone).startsAt,
      from,
      to,
      ctx,
    );
    if (rows.blocks.length + rows.items.length > 100)
      throw new AppError(
        422,
        "COPY_LIMIT",
        "Copy up to 100 plans at a time. Choose a smaller period.",
      );
    const entries: TemplateEntry[] = [
      ...rows.blocks.map((b) => ({
        title: b.title,
        categoryId: b.categoryId,
        goalId: b.goalId,
        notes: b.notes,
        kind: "block" as const,
        dayOffset: daysBetween(from, localDate(b.startsAt, prefs.timezone)),
        startMinute: localMinute(b.startsAt, prefs.timezone),
        durationMinutes: (b.endsAt.getTime() - b.startsAt.getTime()) / 60000,
        dateSpan: null,
      })),
      ...rows.items.map((i) => ({
        title: i.title,
        categoryId: i.categoryId,
        goalId: i.goalId,
        notes: i.notes,
        kind: i.kind,
        dayOffset: daysBetween(from, i.date!),
        startMinute: null,
        durationMinutes: null,
        dateSpan: i.endDate ? daysBetween(i.date!, i.endDate) + 1 : null,
      })),
    ];
    const token = createHash("sha256")
      .update(
        JSON.stringify({
          prefs,
          from,
          to,
          blocks: rows.blocks.map((b) => [b.id, b.version]),
          items: rows.items.map((i) => [i.id, i.version]),
        }),
      )
      .digest("hex");
    return { entries, prefs, from, token };
  }
  function preview(
    entries: TemplateEntry[],
    sourceDate: string,
    targetDate: string,
    timezone: string,
  ): CopyPreview {
    const blocks: CopyPreview["blocks"] = [],
      resultItems: CopyPreview["items"] = [];
    for (const e of entries) {
      const date = addDays(targetDate, e.dayOffset);
      const details = {
        title: e.title,
        categoryId: e.categoryId,
        goalId: e.goalId,
        notes: e.notes,
      };
      if (e.kind === "block") {
        const startsAt = plannedInstant(date, e.startMinute!, timezone);
        if (!startsAt)
          throw new AppError(
            422,
            "MISSING_CLOCK_TIME",
            `A planned time does not exist on ${date} in ${timezone}. Choose another date or edit the source plan.`,
          );
        blocks.push({
          ...details,
          startsAt,
          endsAt: new Date(
            Date.parse(startsAt) + e.durationMinutes! * 60000,
          ).toISOString(),
        });
      } else
        resultItems.push({
          ...details,
          kind: e.kind,
          date,
          endDate: e.kind === "all_day" ? addDays(date, e.dateSpan! - 1) : null,
        });
    }
    return { sourceDate, targetDate, timezone, blocks, items: resultItems };
  }
  async function apply(u: string, v: CopyPreview, ctx: TransactionContext) {
    for (const block of v.blocks) await planning.createBlock(u, block, ctx);
    for (const item of v.items) await items.create(u, item, ctx);
    return {
      count: v.blocks.length + v.items.length,
      targetDate: v.targetDate,
    };
  }
  async function copyPreview(
    u: string,
    input: CopyInput,
    ctx?: TransactionContext,
  ) {
    const v = copyInput.parse(input),
      s = await source(u, v.sourceDate, v.span, ctx);
    const target =
      v.span === "week"
        ? weekRange(v.targetDate, s.prefs.timezone, s.prefs.weekStartsOn)
            .weekStart
        : v.targetDate;
    return {
      ...preview(s.entries, s.from, target, s.prefs.timezone),
      token: s.token,
    };
  }
  return {
    list(u: string, q: PageQuery) {
      return repo.list(u, q);
    },
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    copyPreview,
    copy(u: string, input: CopyInput, token: string, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        const p = await copyPreview(u, input, tx);
        if (p.token !== token) throw staleRevision();
        return apply(u, p, tx);
      }, ctx);
    },
    capture(u: string, input: TemplateCaptureInput, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        const v = templateCaptureInput.parse(input),
          s = await source(u, v.sourceDate, v.span, tx);
        if (!s.entries.length)
          throw new AppError(
            422,
            "EMPTY_TEMPLATE",
            "Add at least one plan before saving a template.",
          );
        return repo.create(u, v, s.entries, tx);
      }, ctx);
    },
    async rename(
      u: string,
      id: string,
      name: string,
      version: number,
      ctx: TransactionContext,
    ) {
      return changed(await repo.rename(u, id, name, version, ctx), () =>
        repo.get(u, id, ctx),
      );
    },
    async remove(
      u: string,
      id: string,
      version: number,
      ctx: TransactionContext,
    ) {
      await changed(await repo.remove(u, id, version, ctx), () =>
        repo.get(u, id, ctx),
      );
      return { ok: true as const };
    },
    async preview(
      u: string,
      id: string,
      targetDate: string,
      ctx?: TransactionContext,
    ) {
      const t = found(await repo.get(u, id, ctx)),
        prefs = await identity.getPreferences(u, ctx);
      const target =
        t.span === "week"
          ? weekRange(targetDate, prefs.timezone, prefs.weekStartsOn).weekStart
          : targetDate;
      return {
        ...preview(t.entries, target, target, prefs.timezone),
        version: t.version,
        preferencesVersion: prefs.version,
      };
    },
    apply(
      u: string,
      id: string,
      date: string,
      version: number,
      preferencesVersion: number,
      ctx?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const p = await this.preview(u, id, date, tx);
        assertRevision(p, version);
        if (p.preferencesVersion !== preferencesVersion) throw staleRevision();
        return apply(u, p, tx);
      }, ctx);
    },
  };
}
export type TemplatesService = ReturnType<typeof templatesService>;
