import {
  calendarItemSchema,
  groupDeleteInput,
  groupDeleteUndoInput,
  type CalendarItem,
  type GroupDeleteInput,
  type GroupDeleteUndoInput,
  selectionMoveInput,
  selectionMoveUndoInput,
  type SelectionMoveInput,
  type SelectionMoveUndoInput,
} from "@168hours/contracts";
import { addDays, shiftPlannedTime } from "@168hours/domain-utils";
import { isDeepStrictEqual } from "node:util";
import type { IdentityService } from "../identity/identity.service.js";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import { AppError, found } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";
import type { SeriesUndoState } from "./planning.types.js";
import type { PlanningService } from "./planning.service.js";
import type { CalendarItemsService } from "./calendar-items.service.js";
import type { calendarSelectionRepository } from "./calendar-selection.repository.js";

export function calendarSelectionService(
  repo: ReturnType<typeof calendarSelectionRepository>,
  planning: PlanningService,
  items: CalendarItemsService,
  identity: IdentityService,
  transaction: RunInTransaction,
) {
  const snapshot = (item: Awaited<ReturnType<CalendarItemsService["get"]>>) =>
    calendarItemSchema.parse(JSON.parse(JSON.stringify(item)));
  const itemInput = (item: CalendarItem) => ({
    title: item.title,
    notes: item.notes,
    categoryId: item.categoryId,
    goalId: item.goalId,
    kind: item.kind,
    date: item.date,
    endDate: item.endDate,
    isException: item.isException,
  });
  const refs = (
    blockEdits: { id: string; version: number }[],
    afterItems: CalendarItem[],
  ) => ({
    blocks: blockEdits.map(({ id, version }) => ({ id, version })),
    items: afterItems.map(({ id, version }) => ({ id, version })),
  });
  return {
    moveGroup(
      userId: string,
      input: SelectionMoveInput,
      context?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const v = selectionMoveInput.parse(input);
        const preferences = await identity.getPreferences(userId, tx);
        if (preferences.timezone !== v.timezone)
          throw new AppError(
            409,
            "MOVE_CONFLICT",
            "Your timezone changed. Reload the calendar before moving plans.",
          );
        const blockEdits: { id: string; version: number; undoId: string }[] =
          [];
        const beforeItems: CalendarItem[] = [],
          afterItems: CalendarItem[] = [];
        const itemSeriesStates: Record<string, SeriesUndoState> = {};
        const families = new Set<string>();
        for (const plan of v.plans) {
          const row =
            plan.kind === "block"
              ? await planning.getBlock(userId, plan.id)
              : await items.get(userId, plan.id);
          if (row.seriesId) families.add(row.seriesId);
        }
        // Lock recurring parents before their children, in the same order for every selection.
        for (const family of [...families].sort())
          await items.seriesState(userId, family, tx);
        for (const plan of [...v.plans].sort((a, b) =>
          (a.kind + a.id).localeCompare(b.kind + b.id),
        )) {
          if (plan.kind === "block") {
            const before = assertRevision(
              await planning.getBlock(userId, plan.id, tx),
              plan.version,
            );
            const times = shiftPlannedTime(
              before.startsAt.toISOString(),
              before.endsAt.toISOString(),
              v.dayDelta,
              v.minuteDelta,
              v.timezone,
            );
            if (!times)
              throw new AppError(
                422,
                "MOVE_TIME",
                "A moved plan falls in a missing clock time. Choose another destination.",
              );
            const after = await planning.updateBlockWithUndo(
              userId,
              plan.id,
              {
                title: before.title,
                notes: before.notes,
                categoryId: before.categoryId,
                goalId: before.goalId,
                ...times,
              },
              plan.version,
              tx,
            );
            blockEdits.push({
              id: after.id,
              version: after.version,
              undoId: after.undoId,
            });
          } else {
            const before = snapshot(
              assertRevision(
                await items.get(userId, plan.id, tx),
                plan.version,
              ),
            );
            if (before.kind !== "all_day")
              throw new AppError(
                422,
                "PLAN_SELECTION",
                "Choose timed or all-day plans.",
              );
            if (before.seriesId)
              itemSeriesStates[before.id] = found(
                (await items.seriesState(userId, before.seriesId, tx)) ??
                  undefined,
              );
            const { isException: _exception, ...values } = itemInput(before);
            const after = await items.update(
              userId,
              plan.id,
              {
                ...values,
                date: addDays(before.date!, v.dayDelta),
                endDate: addDays(before.endDate!, v.dayDelta),
                ...(v.dayDelta === 0
                  ? { isException: before.isException }
                  : {}),
              },
              plan.version,
              tx,
            );
            beforeItems.push(before);
            afterItems.push(snapshot(after));
          }
        }
        const receipt = await repo.createEdit(
          userId,
          { blockEdits, beforeItems, afterItems, itemSeriesStates },
          tx,
        );
        return { undoId: receipt.id, ...refs(blockEdits, afterItems) };
      }, context);
    },
    undoMove(
      userId: string,
      input: SelectionMoveUndoInput,
      context?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const v = selectionMoveUndoInput.parse(input);
        const receipt = found(await repo.getEdit(userId, v.undoId, tx));
        const conflict = () => {
          throw new AppError(
            409,
            "UNDO_CONFLICT",
            "The selected plans changed. This action cannot be undone safely.",
          );
        };
        if (
          v.blocks.length !== receipt.blockEdits.length ||
          v.items.length !== receipt.afterItems.length
        )
          conflict();
        const blockEdits: { id: string; version: number; undoId: string }[] =
          [];
        for (const edit of receipt.blockEdits) {
          const expected = v.blocks.find((b) => b.id === edit.id);
          if (!expected) conflict();
          const result = await planning.undoEdit(
            userId,
            edit.undoId,
            expected!.version,
            tx,
          );
          blockEdits.push({
            id: result.id,
            version: result.version,
            undoId: result.undoId,
          });
        }
        const beforeItems: CalendarItem[] = [],
          afterItems: CalendarItem[] = [];
        const content = ({
          version: _v,
          updatedAt: _t,
          ...rest
        }: CalendarItem) => rest;
        for (let i = 0; i < receipt.afterItems.length; i++) {
          const expected = receipt.afterItems[i]!,
            desired = receipt.beforeItems[i]!;
          const ref = v.items.find((p) => p.id === expected.id);
          if (!ref) conflict();
          const current = snapshot(
            assertRevision(
              await items.get(userId, expected.id, tx),
              ref!.version,
            ),
          );
          if (!isDeepStrictEqual(content(current), content(expected)))
            conflict();
          if (
            expected.seriesId &&
            !isDeepStrictEqual(
              await items.seriesState(userId, expected.seriesId, tx),
              receipt.itemSeriesStates[expected.id],
            )
          )
            conflict();
          beforeItems.push(current);
          afterItems.push(
            snapshot(
              await items.update(
                userId,
                desired.id,
                itemInput(desired),
                current.version,
                tx,
              ),
            ),
          );
        }
        const inverse = await repo.createEdit(
          userId,
          {
            blockEdits,
            beforeItems,
            afterItems,
            itemSeriesStates: receipt.itemSeriesStates,
          },
          tx,
        );
        await repo.removeEdit(userId, receipt.id, tx);
        return { undoId: inverse.id, ...refs(blockEdits, afterItems) };
      }, context);
    },
    deleteGroup(
      userId: string,
      input: GroupDeleteInput,
      context?: TransactionContext,
    ) {
      return transaction(async (tx) => {
        const plans = groupDeleteInput.parse(input).plans;
        const blockUndoIds: string[] = [];
        const snapshots: CalendarItem[] = [];
        const states: Record<string, SeriesUndoState> = {};
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
            if (item.seriesId)
              states[item.id] = found(
                (await items.seriesState(userId, item.seriesId, tx)) ??
                  undefined,
              );
            snapshots.push(
              calendarItemSchema.parse(JSON.parse(JSON.stringify(item))),
            );
            await items.remove(userId, plan.id, plan.version, tx);
          }
        }
        const receipt = await repo.create(
          userId,
          blockUndoIds,
          snapshots,
          tx,
          states,
        );
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
          restoredItems.push(
            await items.restore(
              userId,
              item,
              tx,
              receipt.itemSeriesStates[item.id],
            ),
          );
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
