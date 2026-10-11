import { createHash } from "node:crypto";
import {
  copyInput,
  copyUndoInput,
  dateSchema,
  idSchema,
  snapshotPasteInput,
  templateEntrySchema,
  templateCaptureInput,
  type CopyInput,
  type CopyUndoInput,
  type CopyPreview,
  type SnapshotPasteInput,
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
    targetMinute?: number,
    shiftFromMinute?: number,
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
        const shiftedMinute =
          shiftFromMinute === undefined || targetMinute === undefined
            ? (targetMinute ?? e.startMinute!)
            : e.startMinute! + targetMinute - shiftFromMinute;
        const shiftedDate = addDays(date, Math.floor(shiftedMinute / 1440));
        const startsAt = plannedInstant(
          shiftedDate,
          ((shiftedMinute % 1440) + 1440) % 1440,
          timezone,
        );
        if (!startsAt)
          throw new AppError(
            422,
            "MISSING_CLOCK_TIME",
            `A planned time does not exist on ${shiftedDate} in ${timezone}. Choose another date or edit the source plan.`,
          );
        const endsAt = new Date(
          Date.parse(startsAt) + e.durationMinutes! * 60000,
        ).toISOString();
        blocks.push({
          ...details,
          startsAt,
          endsAt,
        });
      } else {
        const lastDate =
          e.kind === "all_day" ? addDays(date, e.dateSpan! - 1) : date;
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
      !(
        (v.span === "single" && v.sourceKind === "block") ||
        v.span === "selection"
      )
    )
      throw new AppError(
        422,
        "COPY_TIME",
        "A paste time needs selected timed plans.",
      );
    if (v.span === "selection") {
      const selected = v.selectedPlans?.split(",") ?? [];
      if (
        selected.length < 2 ||
        selected.length > 100 ||
        new Set(selected).size !== selected.length ||
        v.selectedDates ||
        v.sourceId ||
        v.sourceKind ||
        v.sourceEndDate
      )
        throw new AppError(
          422,
          "COPY_SOURCE",
          "Choose distinct plans to copy.",
        );
      const prefs = await identity.getPreferences(u, ctx);
      const sources: Array<{
        date: string;
        entry: Omit<TemplateEntry, "dayOffset">;
        id: string;
        version: number;
      }> = [];
      for (const key of selected) {
        const [kind, rawId, extra] = key.split(":");
        if (
          extra !== undefined ||
          (kind !== "block" && kind !== "item") ||
          !idSchema.safeParse(rawId).success
        )
          throw new AppError(422, "COPY_SOURCE", "Choose valid plans to copy.");
        const id = rawId!;
        if (kind === "block") {
          const block = await planning.getBlock(u, id, ctx);
          sources.push({
            id,
            version: block.version,
            date: localDate(block.startsAt, prefs.timezone),
            entry: {
              title: block.title,
              categoryId: block.categoryId,
              goalId: block.goalId,
              notes: block.notes,
              kind: "block",
              startMinute: localMinute(block.startsAt, prefs.timezone),
              durationMinutes:
                (block.endsAt.getTime() - block.startsAt.getTime()) / 60000,
              dateSpan: null,
            },
          });
        } else {
          const item = await items.get(u, id, ctx);
          if (item.kind !== "all_day" || !item.date || !item.endDate)
            throw new AppError(
              422,
              "COPY_SOURCE",
              "Choose dated all-day plans.",
            );
          sources.push({
            id,
            version: item.version,
            date: item.date,
            entry: {
              title: item.title,
              categoryId: item.categoryId,
              goalId: item.goalId,
              notes: item.notes,
              kind: "all_day",
              startMinute: null,
              durationMinutes: null,
              dateSpan: daysBetween(item.date, item.endDate) + 1,
            },
          });
        }
      }
      const from = sources.map((source) => source.date).sort()[0]!;
      const last = sources
        .map((source) => source.date)
        .sort()
        .at(-1)!;
      if (from !== v.sourceDate || daysBetween(from, last) >= 31)
        throw new AppError(422, "COPY_RANGE", "Choose plans within 31 days.");
      const entries = sources.map((source) => ({
        ...source.entry,
        dayOffset: daysBetween(from, source.date),
      }));
      const firstTimedMinute = sources
        .filter((source) => source.entry.kind === "block")
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.entry.startMinute! - b.entry.startMinute!,
        )[0]?.entry.startMinute;
      if (v.targetMinute !== undefined && firstTimedMinute == null)
        throw new AppError(422, "COPY_TIME", "Choose a day for all-day plans.");
      const token = createHash("sha256")
        .update(
          JSON.stringify({
            prefs,
            sources: sources.map(({ id, version }) => [id, version]),
          }),
        )
        .digest("hex");
      return {
        ...preview(
          entries,
          from,
          v.targetDate,
          prefs.timezone,
          v.targetMinute,
          firstTimedMinute ?? undefined,
        ),
        token: copyToken(token, v),
      };
    }
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
        ...preview(entries, from, v.targetDate, prefs.timezone, v.targetMinute),
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
      ...preview(s.entries, s.from, target, s.prefs.timezone),
      token: copyToken(s.token, v),
    };
  }
  async function snapshotPreview(
    u: string,
    input: SnapshotPasteInput,
    ctx?: TransactionContext,
  ) {
    const v = snapshotPasteInput.parse(input);
    const prefs = await identity.getPreferences(u, ctx);
    const entries: TemplateEntry[] = [
      ...v.snapshot.blocks.map((block) =>
        templateEntrySchema.parse({
          title: block.title,
          categoryId: block.categoryId,
          goalId: block.goalId,
          notes: block.notes,
          kind: "block",
          dayOffset: daysBetween(
            v.snapshot.sourceDate,
            localDate(block.startsAt, v.snapshot.timezone),
          ),
          startMinute: localMinute(block.startsAt, v.snapshot.timezone),
          durationMinutes:
            (Date.parse(block.endsAt) - Date.parse(block.startsAt)) / 60000,
          dateSpan: null,
        }),
      ),
      ...v.snapshot.items.map((item) => {
        if (item.kind !== "all_day" || !item.date || !item.endDate)
          throw new AppError(422, "COPY_SOURCE", "Choose dated all-day plans.");
        return templateEntrySchema.parse({
          title: item.title,
          categoryId: item.categoryId,
          goalId: item.goalId,
          notes: item.notes,
          kind: "all_day",
          dayOffset: daysBetween(v.snapshot.sourceDate, item.date),
          startMinute: null,
          durationMinutes: null,
          dateSpan: daysBetween(item.date, item.endDate) + 1,
        });
      }),
    ];
    const firstTimedMinute = entries
      .filter((entry) => entry.kind === "block")
      .sort(
        (a, b) => a.dayOffset - b.dayOffset || a.startMinute! - b.startMinute!,
      )[0]?.startMinute;
    if (v.targetMinute !== undefined && firstTimedMinute == null)
      throw new AppError(422, "COPY_TIME", "Choose a day for all-day plans.");
    return {
      ...preview(
        entries,
        v.snapshot.sourceDate,
        v.targetDate,
        prefs.timezone,
        v.targetMinute,
        firstTimedMinute ?? undefined,
      ),
      token: createHash("sha256")
        .update(JSON.stringify({ userId: u, prefs, input: v }))
        .digest("hex"),
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
    snapshotPreview,
    pasteSnapshot(
      u: string,
      input: SnapshotPasteInput,
      token: string,
      ctx?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const p = await snapshotPreview(u, input, tx);
        if (p.token !== token) throw staleRevision();
        return apply(u, p, tx);
      }, ctx);
    },
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
