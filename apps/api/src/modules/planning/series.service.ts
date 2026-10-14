import { isDeepStrictEqual } from "node:util";
import {
  seriesInput,
  seriesCreateInput,
  seriesUpdateInput,
  seriesChangeInput,
  seriesUndoInput,
  blockSchema,
  calendarItemSchema,
  planConversionInput,
  blockInput,
  calendarItemInput,
  type Block,
  type CalendarItem,
  type BlockInput,
  type CalendarItemInput,
  type PlanConversionInput,
  type SeriesInput,
  type SeriesCreateInput,
  type SeriesUpdateInput,
  type SeriesChangeInput,
  type SeriesUndoInput,
} from "@168hours/contracts";
import {
  addDays,
  daysBetween,
  expandPlannedSeries,
  instantToLocalInput,
} from "@168hours/domain-utils";
import { randomUUID } from "node:crypto";
import type { CategoriesService } from "../categories/categories.service.js";
import type { GoalsService } from "../goals/goals.service.js";
import type { PlanningService } from "./planning.service.js";
import type { CalendarItemsService } from "./calendar-items.service.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { seriesRepository } from "./series.repository.js";
import type { SeriesSnapshot } from "./planning.types.js";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import { AppError, found } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";

export function expandSeries(input: SeriesInput, excluded: string[] = []) {
  return expandPlannedSeries(seriesInput.parse(input), excluded);
}
const ruleOf = (value: SeriesInput) =>
  seriesInput.parse(
    Object.fromEntries(
      Object.keys(seriesInput.shape).map((key) => [
        key,
        value[key as keyof SeriesInput],
      ]),
    ),
  );
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const refs = (states: SeriesSnapshot[]) => ({
  blocks: states.flatMap((s) =>
    s.blocks.map(({ id, version }) => ({ id, version })),
  ),
  items: states.flatMap((s) =>
    s.items.map(({ id, version }) => ({ id, version })),
  ),
});
const empty = (id: string): SeriesSnapshot => ({
  id,
  series: null,
  blocks: [],
  items: [],
});
export function seriesService(
  repo: ReturnType<typeof seriesRepository>,
  categories: CategoriesService,
  goals: GoalsService,
  planning: PlanningService,
  items: CalendarItemsService,
  identity: IdentityService,
  transaction: RunInTransaction,
) {
  async function validate(
    u: string,
    input: SeriesInput,
    ctx: TransactionContext,
  ) {
    const v = seriesInput.parse(input);
    if (v.categoryId) await categories.get(u, v.categoryId, ctx);
    if (v.goalId) await goals.get(u, v.goalId, ctx);
    return v;
  }
  async function discard(
    u: string,
    state: SeriesSnapshot,
    ctx: TransactionContext,
    removed: string[],
  ) {
    for (const b of state.blocks)
      removed.push(
        (await planning.deleteBlockWithUndo(u, b.id, b.version, ctx, false))
          .undoId,
      );
    for (const item of state.items) await repo.removeItem(u, item.id, ctx);
  }
  async function retype(
    u: string,
    old: Block | CalendarItem,
    input: BlockInput | CalendarItemInput,
    ctx: TransactionContext,
    removed: string[],
    exception: boolean,
  ) {
    const metadata = {
      id: old.id,
      version: old.version,
      createdAt: old.createdAt,
      updatedAt: old.updatedAt,
      seriesId: old.seriesId,
      occurrenceDate: old.occurrenceDate,
      isException: exception,
    };
    if ("startsAt" in old) {
      removed.push(
        (await planning.deleteBlockWithUndo(u, old.id, old.version, ctx, false))
          .undoId,
      );
      const next = calendarItemSchema.parse({ ...metadata, ...input });
      await repo.saveItem(u, next, ctx);
      return next;
    }
    await repo.removeItem(u, old.id, ctx);
    const next = blockSchema.parse({ ...metadata, ...input });
    await repo.saveBlock(u, next, ctx);
    return next;
  }
  async function materialize(
    u: string,
    id: string,
    v: SeriesInput,
    excluded: string[],
    preserve: boolean,
    ctx: TransactionContext,
    removed: string[],
  ) {
    const expanded = expandSeries(v, excluded);
    if (!expanded.occurrences.length)
      throw new AppError(
        422,
        "EMPTY_SERIES",
        "This rule has no occurrences. Choose different dates or weekdays.",
      );
    const previous = await repo.snapshot(u, id, ctx);
    const desired = new Set(expanded.occurrences.map((o) => o.date));
    const keep = (old: {
      occurrenceDate: string | null;
      isException: boolean;
    }) =>
      preserve &&
      old.isException &&
      old.occurrenceDate! >= v.startDate &&
      old.occurrenceDate! <= v.untilDate;
    for (const old of previous.blocks)
      if (!desired.has(old.occurrenceDate!) && !keep(old))
        removed.push(
          (
            await planning.deleteBlockWithUndo(
              u,
              old.id,
              old.version,
              ctx,
              false,
            )
          ).undoId,
        );
    for (const old of previous.items)
      if (!desired.has(old.occurrenceDate!) && !keep(old))
        await repo.removeItem(u, old.id, ctx);
    for (const o of expanded.occurrences) {
      const opposite =
        v.kind === "all_day"
          ? previous.blocks.find((b) => b.occurrenceDate === o.date)
          : previous.items.find((b) => b.occurrenceDate === o.date);
      if (opposite && keep(opposite)) continue;
      const details = {
        title: v.title,
        notes: v.notes,
        categoryId: v.categoryId,
        goalId: v.goalId,
      };
      if (opposite) {
        await retype(
          u,
          opposite,
          v.kind === "all_day"
            ? {
                ...details,
                kind: "all_day",
                date: o.date,
                endDate: addDays(o.date, v.dateSpan - 1),
              }
            : { ...details, startsAt: o.startsAt, endsAt: o.endsAt },
          ctx,
          removed,
          false,
        );
        continue;
      }
      if (v.kind === "all_day") {
        const old = previous.items.find((b) => b.occurrenceDate === o.date);
        if (old && keep(old)) continue;
        if (old) await repo.replaceItem(u, old.id, o.date, v, ctx);
        else await repo.insertItem(u, id, o.date, v, ctx);
      } else {
        const old = previous.blocks.find((b) => b.occurrenceDate === o.date);
        if (old && keep(old)) continue;
        const input = {
          title: v.title,
          categoryId: v.categoryId,
          goalId: v.goalId,
          notes: v.notes,
          startsAt: o.startsAt,
          endsAt: o.endsAt,
        };
        if (old) await repo.replaceBlock(u, old.id, input, ctx);
        else await repo.insertBlock(u, id, o.date, input, ctx);
      }
    }
    await repo.resetExcluded(u, id, excluded, ctx);
    return expanded;
  }
  async function receipt(
    u: string,
    before: SeriesSnapshot[],
    after: SeriesSnapshot[],
    removed: string[],
    ctx: TransactionContext,
  ) {
    return repo.recordChange(u, before[0]!.id, before, after, removed, ctx);
  }
  async function result(
    u: string,
    id: string,
    before: SeriesSnapshot[],
    removed: string[],
    ctx: TransactionContext,
    skippedDates: string[] = [],
  ) {
    const after = await Promise.all(
      before.map((s) => repo.snapshot(u, s.id, ctx)),
    );
    const change = await receipt(u, before, after, removed, ctx);
    const state = after.find((s) => s.id === id)!;
    return {
      series: state.series!,
      firstStartsAt:
        state.blocks.map((b) => b.startsAt).sort()[0] ??
        `${state.items[0]?.date ?? state.series!.startDate}T00:00:00.000Z`,
      count: state.blocks.length + state.items.length,
      skippedDates,
      undoId: change.id,
      ...refs(after),
    };
  }
  async function update(
    u: string,
    id: string,
    input: SeriesUpdateInput,
    version: number,
    ctx?: TransactionContext,
    replaceOccurrenceId?: string,
    convertedInput?: {
      input: BlockInput | CalendarItemInput;
      isException: boolean;
    },
  ) {
    return transaction(async (tx) => {
      const v = seriesUpdateInput.parse(input);
      const old = assertRevision(await repo.get(u, id, tx), version);
      const before = [await repo.snapshot(u, id, tx)];
      const removed: string[] = [];
      const rule = await validate(u, ruleOf(v), tx);
      if (
        rule.kind !== old.kind &&
        expandSeries(rule, old.excludedDates).skippedDates.length
      )
        throw new AppError(
          422,
          "CONVERSION_TIME",
          "This time falls in a daylight-saving gap on an occurrence date. Choose another start time.",
        );
      let targetId = id;
      let excluded = old.excludedDates;
      if (v.scope === "following") {
        const cut = v.fromDate;
        if (!cut || cut < old.startDate || cut > old.untilDate)
          throw new AppError(
            422,
            "SERIES_SCOPE",
            "Choose an occurrence within this series.",
          );
        if (cut > old.startDate) {
          const next = await repo.create(u, rule, tx);
          targetId = next.id;
          before.push(empty(next.id));
          for (const b of before[0]!.blocks.filter(
            (b) => b.occurrenceDate! >= cut,
          ))
            await repo.attach(u, "block", b.id, next.id, b.occurrenceDate!, tx);
          for (const item of before[0]!.items.filter(
            (b) => b.occurrenceDate! >= cut,
          ))
            await repo.attach(
              u,
              "item",
              item.id,
              next.id,
              item.occurrenceDate!,
              tx,
            );
          // Membership changes must retain individual override flags.
          for (const b of before[0]!.blocks.filter(
            (b) => b.occurrenceDate! >= cut && b.isException,
          ))
            await repo.restoreOccurrence(u, { ...b, seriesId: next.id }, tx);
          for (const item of before[0]!.items.filter(
            (b) => b.occurrenceDate! >= cut && b.isException,
          ))
            await repo.saveItem(u, { ...item, seriesId: next.id }, tx);
          await repo.update(
            u,
            id,
            ruleOf({ ...old, untilDate: addDays(cut, -1) }),
            tx,
          );
          await repo.resetExcluded(
            u,
            id,
            old.excludedDates.filter((d) => d < cut),
            tx,
          );
          excluded = old.excludedDates.filter((d) => d >= cut);
        }
      }
      if (replaceOccurrenceId) {
        const state = await repo.snapshot(u, targetId, tx);
        const block = state.blocks.find((b) => b.id === replaceOccurrenceId);
        const item = state.items.find((b) => b.id === replaceOccurrenceId);
        if (block)
          await repo.restoreOccurrence(u, { ...block, isException: false }, tx);
        if (item) await repo.saveItem(u, { ...item, isException: false }, tx);
      }
      await repo.update(u, targetId, rule, tx);
      const expanded = await materialize(
        u,
        targetId,
        rule,
        excluded.filter((d) => d >= rule.startDate && d <= rule.untilDate),
        v.preserveExceptions,
        tx,
        removed,
      );
      if (replaceOccurrenceId && convertedInput) {
        const state = await repo.snapshot(u, targetId, tx);
        const block = state.blocks.find((b) => b.id === replaceOccurrenceId);
        const item = state.items.find((b) => b.id === replaceOccurrenceId);
        if (block && "startsAt" in convertedInput.input)
          await repo.restoreOccurrence(
            u,
            {
              ...block,
              ...convertedInput.input,
              isException: convertedInput.isException,
            },
            tx,
          );
        if (item && "kind" in convertedInput.input)
          await repo.saveItem(
            u,
            {
              ...item,
              ...convertedInput.input,
              isException: convertedInput.isException,
            },
            tx,
          );
      }
      return result(u, targetId, before, removed, tx, expanded.skippedDates);
    }, ctx);
  }
  async function remove(
    u: string,
    id: string,
    version: number,
    ctx?: TransactionContext,
    fromDate?: string,
  ) {
    return transaction(async (tx) => {
      const old = assertRevision(await repo.get(u, id, tx), version);
      const before = [await repo.snapshot(u, id, tx)];
      const removed: string[] = [];
      if (
        fromDate &&
        (fromDate < old.startDate || fromDate > addDays(old.untilDate, 1))
      )
        throw new AppError(
          422,
          "SERIES_SCOPE",
          "Choose a date within this series.",
        );
      const subset = {
        ...before[0]!,
        blocks: before[0]!.blocks.filter(
          (b) => !fromDate || b.occurrenceDate! >= fromDate,
        ),
        items: before[0]!.items.filter(
          (b) => !fromDate || b.occurrenceDate! >= fromDate,
        ),
      };
      await discard(u, subset, tx, removed);
      if (!fromDate || fromDate <= old.startDate) await repo.remove(u, id, tx);
      else {
        await repo.update(
          u,
          id,
          ruleOf({ ...old, untilDate: addDays(fromDate, -1) }),
          tx,
        );
        await repo.resetExcluded(
          u,
          id,
          old.excludedDates.filter((d) => d < fromDate),
          tx,
        );
      }
      const after = [await repo.snapshot(u, id, tx)];
      const change = await receipt(u, before, after, removed, tx);
      return { ok: true as const, undoId: change.id, ...refs(after) };
    }, ctx);
  }
  return {
    convertPlan(
      u: string,
      input: PlanConversionInput,
      ctx?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const v = planConversionInput.parse(input);
        if ((await identity.getPreferences(u, tx)).timezone !== v.timezone)
          throw new AppError(
            409,
            "CONVERSION_CONFLICT",
            "Your timezone changed. Open the plan again.",
          );
        const source = assertRevision(
          v.source.kind === "block"
            ? await planning.getBlock(u, v.source.id, tx)
            : await items.get(u, v.source.id, tx),
          v.source.version,
        );
        const old =
          "startsAt" in source
            ? blockSchema.parse(json(source))
            : calendarItemSchema.parse(json(source));
        if ("kind" in old && old.kind !== "all_day")
          throw new AppError(
            422,
            "CONVERSION_KIND",
            "Choose a timed or all-day plan.",
          );
        const target =
          v.target.kind === "timed"
            ? blockInput.parse(v.target.input)
            : calendarItemInput.parse(v.target.input);
        if (target.categoryId) await categories.get(u, target.categoryId, tx);
        if (target.goalId) await goals.get(u, target.goalId, tx);
        const parent = old.seriesId
          ? found(await repo.get(u, old.seriesId, tx))
          : null;
        if (v.scope !== "this") {
          if (!parent)
            throw new AppError(
              422,
              "CONVERSION_SCOPE",
              "Choose one plan, or an occurrence in a repeating series.",
            );
          assertRevision(parent, v.seriesVersion ?? 0);
          const rule = ruleOf(parent);
          rule.kind = v.target.kind;
          for (const field of [
            "title",
            "notes",
            "categoryId",
            "goalId",
          ] as const)
            if (target[field] !== old[field])
              Object.assign(rule, { [field]: target[field] });
          const oldDate =
            "startsAt" in old
              ? instantToLocalInput(old.startsAt, v.timezone).slice(0, 10)
              : old.date!;
          const nextDate =
            "startsAt" in target
              ? instantToLocalInput(target.startsAt, v.timezone).slice(0, 10)
              : target.date!;
          const delta = daysBetween(oldDate, nextDate);
          rule.startDate = addDays(
            v.scope === "following" ? old.occurrenceDate! : parent.startDate,
            delta,
          );
          rule.untilDate = addDays(parent.untilDate, delta);
          rule.weekdays = parent.weekdays.map((d) => (d + (delta % 7) + 7) % 7);
          if ("startsAt" in target) {
            const time = instantToLocalInput(target.startsAt, parent.timezone);
            rule.startMinute =
              Number(time.slice(11, 13)) * 60 + Number(time.slice(14, 16));
            rule.durationMinutes =
              (Date.parse(target.endsAt) - Date.parse(target.startsAt)) / 60000;
          } else rule.dateSpan = daysBetween(target.date!, target.endDate!) + 1;
          const preview = expandSeries(rule, parent.excludedDates);
          if (preview.skippedDates.length)
            throw new AppError(
              422,
              "CONVERSION_TIME",
              "Some occurrences fall in a missing clock time. Choose another start time.",
            );
          const result = await update(
            u,
            parent.id,
            {
              ...rule,
              scope: v.scope,
              fromDate: old.occurrenceDate!,
              preserveExceptions: v.preserveExceptions,
            },
            parent.version,
            tx,
            old.id,
            {
              input: target,
              isException: old.isException && v.preserveExceptions,
            },
          );
          return {
            undoId: result.undoId,
            blocks: result.blocks,
            items: result.items,
          };
        }
        if ("startsAt" in old === (v.target.kind === "timed"))
          throw new AppError(
            422,
            "CONVERSION_KIND",
            "Choose the other plan mode.",
          );
        const root = parent?.id ?? randomUUID();
        const before = parent
          ? await repo.snapshot(u, root, tx)
          : {
              ...empty(root),
              blocks: "startsAt" in old ? [old] : [],
              items: "kind" in old ? [old] : [],
            };
        const removed: string[] = [];
        const next = await retype(u, old, target, tx, removed, !!parent);
        const tracked = {
          ...before,
          blocks: [...before.blocks, ...("startsAt" in next ? [next] : [])],
          items: [...before.items, ...("kind" in next ? [next] : [])],
        };
        const after = await repo.snapshot(u, root, tx, tracked);
        const change = await receipt(u, [before], [after], removed, tx);
        return { undoId: change.id, ...refs([after]) };
      }, ctx);
    },
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    create(u: string, input: SeriesCreateInput, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        const parsed = seriesCreateInput.parse(input);
        const { source, ...inputRule } = parsed;
        const v = await validate(u, inputRule, tx);
        const s = await repo.create(u, v, tx);
        const before = [empty(s.id)];
        if (source) {
          const original = assertRevision(
            source.kind === "block"
              ? await planning.getBlock(u, source.id, tx)
              : await items.get(u, source.id, tx),
            source.version,
          );
          if (
            original.seriesId ||
            (source.kind === "item" &&
              "kind" in original &&
              original.kind !== "all_day") ||
            (source.kind === "block") !== (v.kind === "timed") ||
            !expandSeries(v).occurrences.some((o) => o.date === v.startDate)
          )
            throw new AppError(
              422,
              "SERIES_SOURCE",
              "Choose a standalone plan matching the first occurrence.",
            );
          if (source.kind === "block")
            before[0]!.blocks = [blockSchema.parse(json(original))];
          else before[0]!.items = [calendarItemSchema.parse(json(original))];
          await repo.attach(u, source.kind, source.id, s.id, v.startDate, tx);
        }
        const expanded = await materialize(u, s.id, v, [], false, tx, []);
        return result(u, s.id, before, [], tx, expanded.skippedDates);
      }, ctx);
    },
    update,
    remove,
    change(
      u: string,
      id: string,
      input: SeriesChangeInput,
      version: number,
      ctx?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const v = seriesChangeInput.parse(input);
        const old = assertRevision(await repo.get(u, id, tx), version);
        if (v.operation === "edit" && !v.occurrence)
          throw new AppError(
            422,
            "SERIES_SCOPE",
            "Choose the occurrence being edited.",
          );
        let rule = ruleOf(old);
        let convertedInput:
          | { input: BlockInput | CalendarItemInput; isException: boolean }
          | undefined;
        if (v.occurrence) {
          const o = v.occurrence;
          const record = assertRevision(
            o.kind === "block"
              ? await planning.getBlock(u, o.id, tx)
              : await items.get(u, o.id, tx),
            o.version,
          );
          if (record.seriesId !== id || record.occurrenceDate !== v.fromDate)
            throw new AppError(
              409,
              "SERIES_SCOPE",
              "This occurrence changed. Open it again.",
            );
          if (v.operation === "edit") {
            const change = o.block ?? o.item;
            if (
              !change ||
              (o.kind === "block") !== !!o.block ||
              (o.item && o.item.kind !== "all_day") ||
              ("kind" in record && record.kind !== "all_day")
            )
              throw new AppError(
                422,
                "SERIES_SCOPE",
                "Choose details matching this occurrence's type.",
              );
            const details = { ...rule };
            details.kind = o.block ? "timed" : "all_day";
            const modeChanged = details.kind !== old.kind;
            if (modeChanged)
              convertedInput = {
                input: change,
                isException: v.preserveExceptions && record.isException,
              };
            for (const field of [
              "title",
              "notes",
              "categoryId",
              "goalId",
            ] as const)
              if (change[field] !== record[field])
                Object.assign(details, { [field]: change[field] });
            let dateDelta = 0;
            if (o.block && "startsAt" in record) {
              const before = instantToLocalInput(
                  new Date(record.startsAt).toISOString(),
                  old.timezone,
                ),
                after = instantToLocalInput(o.block.startsAt, old.timezone);
              dateDelta = daysBetween(before.slice(0, 10), after.slice(0, 10));
              const minutes = (s: string) =>
                Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
              if (modeChanged || minutes(before) !== minutes(after))
                details.startMinute = minutes(after);
              const duration =
                (Date.parse(o.block.endsAt) - Date.parse(o.block.startsAt)) /
                60000;
              if (
                modeChanged ||
                duration !==
                  (new Date(record.endsAt).getTime() -
                    new Date(record.startsAt).getTime()) /
                    60000
              )
                details.durationMinutes = duration;
            } else if (o.item && "date" in record) {
              dateDelta = daysBetween(record.date!, o.item.date!);
              const span = daysBetween(o.item.date!, o.item.endDate!) + 1;
              if (
                modeChanged ||
                span !== daysBetween(record.date!, record.endDate!) + 1
              )
                details.dateSpan = span;
            }
            details.startDate = addDays(
              v.scope === "following" ? v.fromDate : old.startDate,
              dateDelta,
            );
            details.untilDate = addDays(old.untilDate, dateDelta);
            details.weekdays = old.weekdays.map(
              (d) => (d + (dateDelta % 7) + 7) % 7,
            );
            rule = seriesInput.parse(details);
          }
        }
        if (v.operation !== "edit")
          return remove(
            u,
            id,
            version,
            tx,
            v.operation === "stop" || v.scope === "following"
              ? v.fromDate
              : undefined,
          );
        return update(
          u,
          id,
          {
            ...rule,
            scope: v.scope,
            fromDate: v.fromDate,
            preserveExceptions: v.preserveExceptions,
          },
          version,
          tx,
          v.occurrence?.id,
          convertedInput,
        );
      }, ctx);
    },
    undo(u: string, input: SeriesUndoInput, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        const v = seriesUndoInput.parse(input),
          change = found(await repo.change(u, v.undoId, tx));
        const tracked = change.before.map((s, i) => ({
          ...s,
          blocks: [...s.blocks, ...change.after[i]!.blocks],
          items: [...s.items, ...change.after[i]!.items],
        }));
        const current = await Promise.all(
          tracked.map((s) => repo.snapshot(u, s.id, tx, s)),
        );
        const content = <
          T extends { version: number; createdAt: string; updatedAt: string },
        >(
          row: T,
        ) => {
          const { version: _v, createdAt: _c, updatedAt: _u, ...rest } = row;
          return rest;
        };
        const normalized = (s: SeriesSnapshot) => ({
          id: s.id,
          series: s.series ? content(s.series) : null,
          blocks: s.blocks
            .map(content)
            .sort((a, b) => a.id.localeCompare(b.id)),
          items: s.items.map(content).sort((a, b) => a.id.localeCompare(b.id)),
        });
        const actual = refs(current);
        if (
          !isDeepStrictEqual(
            current.map(normalized),
            change.after.map(normalized),
          ) ||
          actual.blocks.length !== v.blocks.length ||
          actual.items.length !== v.items.length ||
          actual.blocks.some(
            (b) =>
              !v.blocks.some((e) => e.id === b.id && e.version === b.version),
          ) ||
          actual.items.some(
            (b) =>
              !v.items.some((e) => e.id === b.id && e.version === b.version),
          )
        )
          throw new AppError(
            409,
            "UNDO_CONFLICT",
            "The repeating plan changed. This action cannot be undone safely.",
          );
        const removed: string[] = [];
        for (const state of change.before)
          if (state.series) {
            await validate(u, ruleOf(state.series), tx);
            await repo.restoreDefinition(u, state.series, tx);
          }
        const desiredBlocks = change.before.flatMap((s) => s.blocks),
          desiredItems = change.before.flatMap((s) => s.items);
        for (const s of current)
          await discard(
            u,
            {
              ...s,
              blocks: s.blocks.filter(
                (b) => !desiredBlocks.some((d) => d.id === b.id),
              ),
              items: s.items.filter(
                (b) => !desiredItems.some((d) => d.id === b.id),
              ),
            },
            tx,
            removed,
          );
        for (const b of desiredBlocks)
          if (current.some((s) => s.blocks.some((c) => c.id === b.id)))
            await repo.restoreOccurrence(u, b, tx);
        for (const undoId of change.removedBlockUndoIds)
          await planning.restoreBlock(u, undoId, tx, true);
        for (const item of desiredItems) await repo.saveItem(u, item, tx);
        for (const state of change.before)
          if (!state.series) await repo.remove(u, state.id, tx);
        const restored = await Promise.all(
          tracked.map((s) => repo.snapshot(u, s.id, tx, s)),
        );
        const inverse = await receipt(u, current, restored, removed, tx);
        await repo.consumeChange(u, change.id, tx);
        return { undoId: inverse.id, ...refs(restored) };
      }, ctx);
    },
  };
}
export type SeriesService = ReturnType<typeof seriesService>;
