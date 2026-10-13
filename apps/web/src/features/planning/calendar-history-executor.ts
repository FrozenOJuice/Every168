import { api } from "@/lib/api";
import type { Block } from "@168hours/contracts";
import type { CalendarAction } from "./calendar-history";

export async function applyHistoryAction(action: CalendarAction, key: string) {
  let block: Block | null = null;
  let selection: {
    blocks: { id: string; version: number }[];
    items: { id: string; version: number }[];
  } | null = null;
  let inverse: CalendarAction | null = null;
  if (action.kind === "series") {
    const result = await api.undoCalendarSeries(
      { undoId: action.undoId, blocks: action.blocks },
      key,
    );
    selection = result;
    inverse = { ...action, undoId: result.undoId, blocks: result.blocks };
  } else if (action.kind === "item-edit") {
    const item = await api.updateCalendarItem(
      action.itemId,
      action.before,
      action.version,
      key,
    );
    selection = { blocks: [], items: [{ id: item.id, version: item.version }] };
    inverse = {
      ...action,
      version: item.version,
      before: action.after,
      after: action.before,
    };
  } else if (action.kind === "activity-create") {
    const remove = {
      food: api.deleteFoodEntry,
      water: api.deleteWater,
      weight: api.deleteWeight,
      cardio: api.deleteCardio,
      strength: api.deleteWorkout,
      entry: api.deleteTimeEntry,
    }[action.resource];
    await remove(action.id, action.version, key);
  } else if (action.kind === "group-delete") {
    selection = await api.undoCalendarSelectionDelete(
      { undoId: action.undoId },
      key,
    );
    inverse = {
      key: action.key,
      kind: "copy",
      blocks: selection.blocks,
      items: selection.items,
    };
  } else if (action.kind === "copy") {
    if (action.transient)
      await api.undoCalendarCopy(
        { blocks: action.blocks, items: action.items },
        key,
      );
    else {
      const result = await api.deleteCalendarSelection(
        {
          plans: [
            ...action.blocks.map((record) => ({
              ...record,
              kind: "block" as const,
            })),
            ...action.items.map((record) => ({
              ...record,
              kind: "item" as const,
            })),
          ],
        },
        key,
      );
      inverse = {
        key: action.key,
        kind: "group-delete",
        undoId: result.undoId,
      };
    }
  } else if (action.kind === "delete") {
    block = await api.restoreTimeBlock(action.undoId, key);
    inverse = {
      key: action.key,
      kind: "create",
      blockId: block.id,
      title: block.title,
      version: block.version,
    };
  } else if (action.kind === "edit") {
    const result = await api.undoTimeBlockEdit(
      action.undoId,
      action.version,
      key,
    );
    block = result;
    inverse = {
      ...action,
      version: result.version,
      previousVersion: action.version,
      undoId: result.undoId,
    };
  } else {
    const result = await api.deleteTimeBlock(
      action.blockId,
      action.version,
      key,
    );
    inverse = {
      key: action.key,
      kind: "delete",
      blockId: action.blockId,
      title: action.title,
      previousVersion: action.version,
      undoId: result.undoId,
    };
  }
  return { block, selection, inverse: action.transient ? null : inverse };
}
