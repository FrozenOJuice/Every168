import {
  calendarItemInput,
  type BlockInput,
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
import { found } from "../../shared/errors/app-error.js";
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
    backlog(u: string, q: PageQuery) {
      return repo.backlog(u, q);
    },
    async create(u: string, v: CalendarItemInput, ctx?: TransactionContext) {
      return repo.create(u, await validate(u, v, ctx), ctx);
    },
    async update(
      u: string,
      id: string,
      v: CalendarItemInput,
      version: number,
      ctx?: TransactionContext,
    ) {
      return repo.update(u, id, await validate(u, v, ctx), version, ctx);
    },
    async remove(
      u: string,
      id: string,
      version: number,
      ctx?: TransactionContext,
    ) {
      await repo.remove(u, id, version, ctx);
      return { ok: true as const };
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
