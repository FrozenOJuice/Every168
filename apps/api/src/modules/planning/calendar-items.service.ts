import {
  calendarItemInput,
  calendarItemSchema,
  calendarItemUpdateInput,
  type BlockInput,
  type CalendarItem,
  type CalendarItemInput,
  type PageQuery,
} from "@168hours/contracts";
import type { CategoriesService } from "../categories/categories.service.js";
import type { GoalsService } from "../goals/goals.service.js";
import type { PlanningService } from "./planning.service.js";
import type { calendarItemsRepository } from "./calendar-items.repository.js";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import type { SeriesUndoState } from "./planning.types.js";
import { AppError, found } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";
export function calendarItemsService(
  repo: ReturnType<typeof calendarItemsRepository>,
  categories: CategoriesService,
  goals: GoalsService,
  planning: PlanningService,
  transaction: RunInTransaction,
) {
  async function validate(
    u: string,
    input: CalendarItemInput,
    context?: TransactionContext,
  ) {
    const v = calendarItemInput.parse(input);
    if (v.categoryId) await categories.get(u, v.categoryId, context);
    if (v.goalId) await goals.get(u, v.goalId, context);
    return v;
  }
  return {
    async get(u: string, id: string, ctx?: TransactionContext) {
      return found(await repo.get(u, id, ctx));
    },
    range: repo.range,
    seriesState: repo.seriesState,
    backlog(u: string, q: PageQuery) {
      return repo.backlog(u, q);
    },
    async create(u: string, v: CalendarItemInput, ctx?: TransactionContext) {
      return repo.create(u, await validate(u, v, ctx), ctx);
    },
    update(
      u: string,
      id: string,
      v: CalendarItemInput & { isException?: boolean },
      version: number,
      ctx?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const input = calendarItemUpdateInput.parse(v);
        const original = await this.get(u, id, tx);
        if (original.seriesId && input.kind !== "all_day")
          throw new AppError(
            422,
            "SERIES_KIND",
            "A repeating all-day plan must remain all-day.",
          );
        const values = await validate(
          u,
          calendarItemInput.parse(
            Object.fromEntries(
              Object.keys(calendarItemInput.shape).map((key) => [
                key,
                input[key as keyof typeof input],
              ]),
            ),
          ),
          tx,
        );
        return repo.update(
          u,
          id,
          {
            ...values,
            ...(input.isException === undefined
              ? {}
              : { isException: input.isException }),
          },
          version,
          tx,
        );
      }, ctx);
    },
    remove(u: string, id: string, version: number, ctx?: TransactionContext) {
      return transaction(async (tx) => {
        await repo.remove(u, id, version, tx);
        return { ok: true as const };
      }, ctx);
    },
    async restore(
      u: string,
      snapshot: CalendarItem,
      ctx: TransactionContext,
      state?: SeriesUndoState,
    ) {
      const item = calendarItemSchema.parse(snapshot);
      await validate(
        u,
        {
          title: item.title,
          categoryId: item.categoryId,
          goalId: item.goalId,
          notes: item.notes,
          kind: item.kind,
          date: item.date,
          endDate: item.endDate,
        },
        ctx,
      );
      return repo.restore(u, item, ctx, state);
    },
    schedule(
      u: string,
      id: string,
      v: BlockInput,
      version: number,
      ctx?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        assertRevision(await repo.get(u, id, tx), version);
        const block = await planning.createBlock(u, v, tx);
        await repo.remove(u, id, version, tx);
        return block;
      }, ctx);
    },
  };
}
export type CalendarItemsService = ReturnType<typeof calendarItemsService>;
