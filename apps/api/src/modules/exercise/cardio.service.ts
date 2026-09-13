import { assertRevision } from "../../shared/errors/revision.js";
import { paceSecondsPerKm } from "@168hours/domain-utils";
import type { CardioInput, CardioHistoryQuery } from "@168hours/contracts";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import { found } from "../../shared/errors/app-error.js";
import type { PlanningService } from "../planning/planning.service.js";
import type { cardioRepository } from "./cardio.repository.js";
type Row = NonNullable<
  Awaited<ReturnType<ReturnType<typeof cardioRepository>["get"]>>
>;
const view = (row: Row) => ({
  ...row,
  paceSecondsPerKm: paceSecondsPerKm(
    row.activityType,
    row.durationSeconds,
    row.distanceMeters,
  ),
});
export function cardioService(
  runInTransaction: RunInTransaction,
  repo: ReturnType<typeof cardioRepository>,
  planning: PlanningService,
) {
  async function record(tx: TransactionContext, u: string, row: Row) {
    const block = row.linkedTimeBlockId
      ? await planning.getBlock(u, row.linkedTimeBlockId, tx)
      : null;
    await planning.recordSource(tx, u, {
      title: row.title,
      categoryId: block?.categoryId ?? null,
      timeBlockId: row.linkedTimeBlockId,
      startsAt: row.startedAt.toISOString(),
      endsAt: new Date(
        row.startedAt.getTime() + row.durationSeconds * 1000,
      ).toISOString(),
      sourceType: "cardio_activity",
      sourceId: row.id,
    });
  }
  return {
    async list(u: string, q: CardioHistoryQuery) {
      const result = await repo.list(u, q);
      return { ...result, items: result.items.map(view) };
    },
    async get(u: string, id: string) {
      return view(found(await repo.get(u, id)));
    },
    async latest(u: string) {
      const row = await repo.latest(u);
      return row ? view(row) : null;
    },
    async create(u: string, v: CardioInput, context?: TransactionContext) {
      return runInTransaction(async (tx) => {
        if (v.linkedTimeBlockId)
          await planning.getBlock(u, v.linkedTimeBlockId, tx);
        const row = await repo.create(tx, u, v);
        await record(tx, u, row);
        return view(row);
      }, context);
    },
    async update(
      u: string,
      id: string,
      v: CardioInput,
      version: number,
      context?: TransactionContext,
    ) {
      return runInTransaction(async (tx) => {
        assertRevision(await repo.get(u, id, tx, true), version);
        if (v.linkedTimeBlockId)
          await planning.getBlock(u, v.linkedTimeBlockId, tx);
        const row = found(await repo.update(tx, u, id, v));
        await record(tx, u, row);
        return view(row);
      }, context);
    },
    async remove(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      return runInTransaction(async (tx) => {
        assertRevision(await repo.get(u, id, tx, true), version);
        await planning.removeSource(tx, u, "cardio_activity", id);
        found(await repo.remove(tx, u, id));
        return { ok: true as const };
      }, context);
    },
  };
}
export type CardioService = ReturnType<typeof cardioService>;
