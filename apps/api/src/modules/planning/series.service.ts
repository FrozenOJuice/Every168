import {
  seriesInput,
  seriesUndoInput,
  type SeriesInput,
  type SeriesUndoInput,
} from "@168hours/contracts";
import { isDeepStrictEqual } from "node:util";
import { expandPlannedSeries } from "@168hours/domain-utils";
import type { CategoriesService } from "../categories/categories.service.js";
import type { GoalsService } from "../goals/goals.service.js";
import type { PlanningService } from "./planning.service.js";
import type { seriesRepository } from "./series.repository.js";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import { AppError, found } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";

export function expandSeries(input: SeriesInput, excluded: string[] = []) {
  return expandPlannedSeries(seriesInput.parse(input), excluded);
}
export function seriesService(
  repo: ReturnType<typeof seriesRepository>,
  categories: CategoriesService,
  goals: GoalsService,
  planning: PlanningService,
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
  async function materialize(
    u: string,
    id: string,
    v: SeriesInput,
    excluded: string[],
    ctx: TransactionContext,
    removedBlockUndoIds: string[],
  ) {
    const { occurrences, skippedDates } = expandSeries(v, excluded);
    if (!occurrences.length)
      throw new AppError(
        422,
        "EMPTY_SERIES",
        "This rule has no occurrences. Choose different dates or weekdays.",
      );
    const previous = await repo.blocks(u, id, ctx);
    const desired = new Set(occurrences.map((o) => o.date));
    for (const old of previous)
      if (!desired.has(old.occurrenceDate!))
        removedBlockUndoIds.push(
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
    for (const occurrence of occurrences) {
      const input = {
        title: v.title,
        categoryId: v.categoryId,
        goalId: v.goalId,
        notes: v.notes,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
      };
      const old = previous.find((b) => b.occurrenceDate === occurrence.date);
      if (old) await repo.replaceBlock(u, old.id, input, ctx);
      else await repo.insertBlock(u, id, occurrence.date, input, ctx);
    }
    await repo.resetExcluded(u, id, excluded, ctx);
    return {
      series: found(await repo.get(u, id, ctx)),
      firstStartsAt: occurrences[0]!.startsAt,
      count: occurrences.length,
      skippedDates,
    };
  }
  return {
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    create(u: string, input: SeriesInput, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        const v = await validate(u, input, tx),
          s = await repo.create(u, v, tx);
        const result = await materialize(u, s.id, v, [], tx, []);
        const after = await repo.snapshot(u, s.id, tx);
        const receipt = await repo.recordChange(
          u,
          s.id,
          null,
          [],
          after.series,
          after.blocks,
          [],
          tx,
        );
        return {
          ...result,
          undoId: receipt.id,
          blocks: after.blocks.map(({ id, version }) => ({ id, version })),
        };
      }, ctx);
    },
    update(
      u: string,
      id: string,
      input: SeriesInput,
      version: number,
      ctx?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const old = assertRevision(await repo.get(u, id, tx), version);
        const before = await repo.snapshot(u, id, tx);
        const removedBlockUndoIds: string[] = [];
        const v = await validate(u, input, tx);
        await repo.update(u, id, v, tx);
        const result = await materialize(
          u,
          id,
          v,
          old.excludedDates.filter(
            (date) => date >= v.startDate && date <= v.untilDate,
          ),
          tx,
          removedBlockUndoIds,
        );
        const after = await repo.snapshot(u, id, tx);
        const receipt = await repo.recordChange(
          u,
          id,
          before.series,
          before.blocks,
          after.series,
          after.blocks,
          removedBlockUndoIds,
          tx,
        );
        return {
          ...result,
          undoId: receipt.id,
          blocks: after.blocks.map(({ id, version }) => ({ id, version })),
        };
      }, ctx);
    },
    remove(u: string, id: string, version: number, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        assertRevision(await repo.get(u, id, tx), version);
        const before = await repo.snapshot(u, id, tx);
        const removedBlockUndoIds: string[] = [];
        for (const b of await repo.blocks(u, id, tx))
          removedBlockUndoIds.push(
            (await planning.deleteBlockWithUndo(u, b.id, b.version, tx, false))
              .undoId,
          );
        await repo.remove(u, id, tx);
        const receipt = await repo.recordChange(
          u,
          id,
          before.series,
          before.blocks,
          null,
          [],
          removedBlockUndoIds,
          tx,
        );
        return { ok: true as const, undoId: receipt.id };
      }, ctx);
    },
    undo(u: string, input: SeriesUndoInput, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        const v = seriesUndoInput.parse(input);
        const receipt = found(await repo.change(u, v.undoId, tx));
        const current = await repo.snapshot(u, receipt.seriesId, tx);
        const content = (row: {
          version: number;
          createdAt: string;
          updatedAt: string;
        }) => {
          const {
            version: _version,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            ...rest
          } = row;
          return rest;
        };
        // Parent revisions also advance during our own occurrence inverses.
        // Compare the rule/exclusions and every occurrence's content and expected revision.
        if (
          !isDeepStrictEqual(
            current.series ? content(current.series) : null,
            receipt.after ? content(receipt.after) : null,
          ) ||
          !isDeepStrictEqual(
            current.blocks.map(content),
            receipt.afterBlocks.map(content),
          ) ||
          current.blocks.length !== v.blocks.length ||
          current.blocks.some(
            (block) =>
              !v.blocks.some(
                (expected) =>
                  expected.id === block.id &&
                  expected.version === block.version,
              ),
          )
        )
          throw new AppError(
            409,
            "UNDO_CONFLICT",
            "The repeating plan changed. This action cannot be undone safely.",
          );
        const beforeIds = new Set(
          receipt.beforeBlocks.map((block) => block.id),
        );
        for (const block of current.blocks)
          if (!beforeIds.has(block.id))
            await planning.deleteBlock(u, block.id, block.version, tx, false);
        if (receipt.before) {
          const {
            id: _id,
            version: _version,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            excludedDates: _excludedDates,
            ...rule
          } = receipt.before;
          await validate(u, rule, tx);
          await repo.restoreDefinition(u, receipt.before, tx);
          for (const block of receipt.beforeBlocks)
            if (current.blocks.some((candidate) => candidate.id === block.id))
              await repo.restoreOccurrence(u, block, tx);
          for (const undoId of receipt.removedBlockUndoIds)
            await planning.restoreBlock(u, undoId, tx, true);
        } else await repo.remove(u, receipt.seriesId, tx);
        const restored = await repo.snapshot(u, receipt.seriesId, tx);
        await repo.consumeChange(u, receipt.id, tx);
        return {
          blocks: restored.blocks.map(({ id, version }) => ({ id, version })),
          items: [],
        };
      }, ctx);
    },
  };
}
export type SeriesService = ReturnType<typeof seriesService>;
