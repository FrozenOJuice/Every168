import { seriesInput, type SeriesInput } from "@168hours/contracts";
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
        await planning.deleteBlock(u, old.id, old.version, ctx, false);
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
        return materialize(u, s.id, v, [], tx);
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
        const v = await validate(u, input, tx);
        await repo.update(u, id, v, tx);
        return materialize(
          u,
          id,
          v,
          old.excludedDates.filter(
            (date) => date >= v.startDate && date <= v.untilDate,
          ),
          tx,
        );
      }, ctx);
    },
    remove(u: string, id: string, version: number, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        assertRevision(await repo.get(u, id, tx), version);
        for (const b of await repo.blocks(u, id, tx))
          await planning.deleteBlock(u, b.id, b.version, tx, false);
        await repo.remove(u, id, tx);
        return { ok: true as const };
      }, ctx);
    },
  };
}
export type SeriesService = ReturnType<typeof seriesService>;
