import { createHash } from "node:crypto";
import {
  copyInput,
  copyUndoInput,
  dateSchema,
  templateCaptureInput,
  type CopyInput,
  type CopyUndoInput,
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
  const copyToken = (base: string, input: CopyInput) =>
    createHash("sha256").update(JSON.stringify({ base, input })).digest("hex");
  async function source(
    u: string,
    date: string,
    span: "day" | "week" | "range",
    endDate?: string,
    ctx?: TransactionContext,
    selectedDates?: string[],
  ) {
    const prefs = await identity.getPreferences(u, ctx);
    const from =
      span === "week"
        ? weekRange(date, prefs.timezone, prefs.weekStartsOn).weekStart
        : date;
    const days =
      span === "week"
        ? 7
        : span === "day"
          ? 1
          : endDate
            ? daysBetween(from, endDate)
            : -1;
    if (span === "range" && (days < 0 || days >= 31))
      throw new AppError(422, "COPY_RANGE", "Choose a range of 1 to 31 days.");
    const periodDays = span === "range" ? days + 1 : days;
    const to = addDays(from, periodDays);
    const rows = await repo.source(
      u,
      dayRange(from, prefs.timezone).startsAt,
      dayRange(to, prefs.timezone).startsAt,
      from,
      to,
      selectedDates,
      prefs.timezone,
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
    return { entries, prefs, from, token, periodDays };
  }
  function preview(
    entries: TemplateEntry[],
    sourceDate: string,
    targetDate: string,
    timezone: string,
    skipSourceOverlap = false,
    targetMinute?: number,
  ): CopyPreview {
    const blocks: CopyPreview["blocks"] = [],
      resultItems: CopyPreview["items"] = [];
    let skipped = 0;
    for (const e of entries) {
      const date = addDays(targetDate, e.dayOffset);
      const originalDate = addDays(sourceDate, e.dayOffset);
      const details = {
        title: e.title,
        categoryId: e.categoryId,
        goalId: e.goalId,
        notes: e.notes,
      };
      if (e.kind === "block") {
        const startsAt = plannedInstant(
          date,
          targetMinute ?? e.startMinute!,
          timezone,
        );
        if (!startsAt)
          throw new AppError(
            422,
            "MISSING_CLOCK_TIME",
            `A planned time does not exist on ${date} in ${timezone}. Choose another date or edit the source plan.`,
          );
        const endsAt = new Date(
          Date.parse(startsAt) + e.durationMinutes! * 60000,
        ).toISOString();
        const originalStart = plannedInstant(
          originalDate,
          e.startMinute!,
          timezone,
        );
        if (
          skipSourceOverlap &&
          originalStart &&
          Date.parse(startsAt) <
            Date.parse(originalStart) + e.durationMinutes! * 60000 &&
          Date.parse(endsAt) > Date.parse(originalStart)
        ) {
          skipped++;
          continue;
        }
        blocks.push({
          ...details,
          startsAt,
          endsAt,
        });
      } else {
        const lastDate =
          e.kind === "all_day" ? addDays(date, e.dateSpan! - 1) : date;
        const originalLast =
          e.kind === "all_day"
            ? addDays(originalDate, e.dateSpan! - 1)
            : originalDate;
        if (
          skipSourceOverlap &&
          date <= originalLast &&
          originalDate <= lastDate
        ) {
          skipped++;
          continue;
        }
        resultItems.push({
          ...details,
          kind: e.kind,
          date,
          endDate: e.kind === "all_day" ? lastDate : null,
        });
      }
    }
    return {
      sourceDate,
      targetDate,
      timezone,
      blocks,
      items: resultItems,
      skipped,
    };
  }
  async function apply(u: string, v: CopyPreview, ctx: TransactionContext) {
    const createdBlocks = [];
    const createdItems = [];
    for (const block of v.blocks)
      createdBlocks.push(await planning.createBlock(u, block, ctx));
    for (const item of v.items)
      createdItems.push(await items.create(u, item, ctx));
    return {
      count: v.blocks.length + v.items.length,
      targetDate: v.targetDate,
      createdBlocks: createdBlocks.map((block) => ({
        id: block.id,
        version: block.version,
        title: block.title,
      })),
      createdItems: createdItems.map((item) => ({
        id: item.id,
        version: item.version,
      })),
    };
  }
  async function copyPreview(
    u: string,
    input: CopyInput,
    ctx?: TransactionContext,
  ) {
    const v = copyInput.parse(input);
    const selectedDates = v.selectedDates?.split(",");
    if (
      selectedDates &&
      (v.span !== "range" ||
        selectedDates.some(
          (date) =>
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !dateSchema.safeParse(date).success ||
            date < v.sourceDate ||
            !v.sourceEndDate ||
            date > v.sourceEndDate,
        ) ||
        selectedDates[0] !== v.sourceDate ||
        selectedDates.at(-1) !== v.sourceEndDate ||
        new Set(selectedDates).size !== selectedDates.length ||
        selectedDates.some(
          (date, index) => index > 0 && date <= selectedDates[index - 1]!,
        ))
    )
      throw new AppError(
        422,
        "COPY_DATES",
        "Choose ordered source dates within the range.",
      );
    if (
      v.targetMinute !== undefined &&
      (v.span !== "single" || v.sourceKind !== "block")
    )
      throw new AppError(
        422,
        "COPY_TIME",
        "A paste time needs one timed plan.",
      );
    if (v.span === "single") {
      if (!v.sourceId || !v.sourceKind)
        throw new AppError(422, "COPY_SOURCE", "Choose a plan to copy.");
      const prefs = await identity.getPreferences(u, ctx);
      let from: string;
      let entries: TemplateEntry[];
      let revision: number;
      if (v.sourceKind === "block") {
        const block = await planning.getBlock(u, v.sourceId, ctx);
        from = localDate(block.startsAt, prefs.timezone);
        revision = block.version;
        entries = [
          {
            title: block.title,
            categoryId: block.categoryId,
            goalId: block.goalId,
            notes: block.notes,
            kind: "block",
            dayOffset: 0,
            startMinute: localMinute(block.startsAt, prefs.timezone),
            durationMinutes:
              (block.endsAt.getTime() - block.startsAt.getTime()) / 60000,
            dateSpan: null,
          },
        ];
      } else {
        const item = await items.get(u, v.sourceId, ctx);
        if (!item.date)
          throw new AppError(
            422,
            "COPY_SOURCE",
            "This plan has no calendar date.",
          );
        from = item.date;
        revision = item.version;
        entries = [
          {
            title: item.title,
            categoryId: item.categoryId,
            goalId: item.goalId,
            notes: item.notes,
            kind: item.kind,
            dayOffset: 0,
            startMinute: null,
            durationMinutes: null,
            dateSpan: item.endDate ? daysBetween(from, item.endDate) + 1 : null,
          },
        ];
      }
      const token = createHash("sha256")
        .update(JSON.stringify({ prefs, id: v.sourceId, version: revision }))
        .digest("hex");
      return {
        ...preview(
          entries,
          from,
          v.targetDate,
          prefs.timezone,
          true,
          v.targetMinute,
        ),
        token: copyToken(token, v),
      };
    }
    const s = await source(
      u,
      v.sourceDate,
      v.span,
      v.sourceEndDate,
      ctx,
      selectedDates,
    );
    const target =
      v.span === "week"
        ? weekRange(v.targetDate, s.prefs.timezone, s.prefs.weekStartsOn)
            .weekStart
        : v.targetDate;
    return {
      ...preview(s.entries, s.from, target, s.prefs.timezone, true),
      token: copyToken(s.token, v),
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
    undoCopy(u: string, input: CopyUndoInput, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        const v = copyUndoInput.parse(input);
        for (const block of v.blocks)
          await planning.deleteBlock(u, block.id, block.version, tx);
        for (const item of v.items)
          await items.remove(u, item.id, item.version, tx);
        return { ok: true as const };
      }, ctx);
    },
    capture(u: string, input: TemplateCaptureInput, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        const v = templateCaptureInput.parse(input),
          s = await source(u, v.sourceDate, v.span, v.sourceEndDate, tx);
        if (!s.entries.length)
          throw new AppError(
            422,
            "EMPTY_TEMPLATE",
            "Add at least one plan before saving a template.",
          );
        return repo.create(
          u,
          { ...v, rangeDays: v.span === "range" ? s.periodDays : null },
          s.entries,
          tx,
        );
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
      cycles = 1,
      ctx?: TransactionContext,
    ) {
      const t = found(await repo.get(u, id, ctx)),
        prefs = await identity.getPreferences(u, ctx);
      const target =
        t.span === "week"
          ? weekRange(targetDate, prefs.timezone, prefs.weekStartsOn).weekStart
          : targetDate;
      const periodDays =
        t.span === "week" ? 7 : t.span === "day" ? 1 : t.rangeDays!;
      if (
        cycles < 1 ||
        cycles > 52 ||
        periodDays * cycles > 366 ||
        t.entries.length * cycles > 100
      )
        throw new AppError(
          422,
          "TEMPLATE_LIMIT",
          "Use at most 100 plans across 366 days.",
        );
      const entries = Array.from({ length: cycles }, (_, cycle) =>
        t.entries.map((entry) => ({
          ...entry,
          dayOffset: entry.dayOffset + cycle * periodDays,
        })),
      ).flat();
      return {
        ...preview(entries, target, target, prefs.timezone),
        version: t.version,
        preferencesVersion: prefs.version,
      };
    },
    apply(
      u: string,
      id: string,
      date: string,
      cycles: number,
      version: number,
      preferencesVersion: number,
      ctx?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const p = await this.preview(u, id, date, cycles, tx);
        assertRevision(p, version);
        if (p.preferencesVersion !== preferencesVersion) throw staleRevision();
        return apply(u, p, tx);
      }, ctx);
    },
  };
}
export type TemplatesService = ReturnType<typeof templatesService>;
