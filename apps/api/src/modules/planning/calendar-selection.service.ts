import {
  calendarItemSchema,
  groupDeleteInput,
  groupDeleteUndoInput,
  type CalendarItem,
  type GroupDeleteInput,
  type GroupDeleteUndoInput,
} from "@168hours/contracts";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import { AppError, found } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";
import type { PlanningService } from "./planning.service.js";
import type { CalendarItemsService } from "./calendar-items.service.js";
import type { calendarSelectionRepository } from "./calendar-selection.repository.js";

export function calendarSelectionService(
  repo: ReturnType<typeof calendarSelectionRepository>,
  planning: PlanningService,
  items: CalendarItemsService,
  transaction: RunInTransaction,
) {
  return {
    deleteGroup(
      userId: string,
      input: GroupDeleteInput,
      context?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const plans = groupDeleteInput.parse(input).plans;
        const blockUndoIds: string[] = [];
        const snapshots: CalendarItem[] = [];
        for (const plan of plans) {
          if (plan.kind === "block") {
            const deleted = await planning.deleteBlockWithUndo(
              userId,
              plan.id,
              plan.version,
              tx,
            );
            blockUndoIds.push(deleted.undoId);
          } else {
            const item = assertRevision(
              await items.get(userId, plan.id, tx),
              plan.version,
            );
            if (item.kind !== "all_day")
              throw new AppError(
                422,
                "PLAN_SELECTION",
                "Choose all-day plans.",
              );
            snapshots.push(
              calendarItemSchema.parse(JSON.parse(JSON.stringify(item))),
            );
            await items.remove(userId, plan.id, plan.version, tx);
          }
        }
        const receipt = await repo.create(userId, blockUndoIds, snapshots, tx);
        return { ok: true as const, undoId: receipt.id };
      }, context);
    },
    undoGroup(
      userId: string,
      input: GroupDeleteUndoInput,
      context?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const { undoId } = groupDeleteUndoInput.parse(input);
        const receipt = found(await repo.get(userId, undoId, tx));
        const blocks = [];
        const restoredItems = [];
        for (const blockUndoId of receipt.blockUndoIds)
          blocks.push(await planning.restoreBlock(userId, blockUndoId, tx));
        for (const item of receipt.items)
          restoredItems.push(await items.restore(userId, item, tx));
        await repo.remove(userId, undoId, tx);
        return {
          ok: true as const,
          blocks: blocks.map(({ id, version }) => ({ id, version })),
          items: restoredItems.map(({ id, version }) => ({ id, version })),
        };
      }, context);
    },
  };
}
export type CalendarSelectionService = ReturnType<
  typeof calendarSelectionService
>;
