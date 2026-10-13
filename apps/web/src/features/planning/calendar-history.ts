import type { Block, CalendarItemInput } from "@168hours/contracts";
type RestoredSelection = {
  blocks: { id: string; version: number }[];
  items: { id: string; version: number }[];
};

export type CalendarAction = (
  | ({ key: string; blockId: string; title: string } & (
      | { kind: "create"; version: number }
      | {
          kind: "edit";
          version: number;
          previousVersion: number;
          undoId: string;
        }
      | { kind: "delete"; previousVersion: number; undoId: string }
    ))
  | {
      key: string;
      kind: "copy";
      blocks: { id: string; version: number }[];
      items: { id: string; version: number }[];
    }
  | {
      key: string;
      kind: "group-delete";
      undoId: string;
    }
  | {
      key: string;
      kind: "item-edit";
      itemId: string;
      version: number;
      before: CalendarItemInput;
      after: CalendarItemInput;
    }
  | {
      key: string;
      kind: "activity-create";
      resource: "food" | "water" | "weight" | "cardio" | "strength" | "entry";
      id: string;
      version: number;
    }
  | {
      key: string;
      kind: "series";
      undoId: string;
      blocks: { id: string; version: number }[];
    }
) & { transient?: boolean };

export function recordAction(
  history: CalendarAction[],
  action: CalendarAction,
) {
  return history.some((entry) => entry.key === action.key)
    ? history
    : [...history, action];
}

/** Only our own confirmed inverse can advance the next action's expected revision. */
export function undoAction(
  history: CalendarAction[],
  action: CalendarAction,
  restored: Block | null,
  selection?: RestoredSelection | null,
) {
  if (history.at(-1)?.key !== action.key) return history;
  const remaining = history.slice(0, -1);
  if (action.kind === "copy") return remaining;
  if (selection) {
    for (const block of selection.blocks) {
      const index = remaining.findLastIndex((entry) =>
        entry.kind === "copy" || entry.kind === "series"
          ? entry.blocks.some((record) => record.id === block.id)
          : "blockId" in entry && entry.blockId === block.id,
      );
      const previous = remaining[index];
      if (previous?.kind === "copy" || previous?.kind === "series")
        remaining[index] = {
          ...previous,
          blocks: previous.blocks.map((record) =>
            record.id === block.id ? block : record,
          ),
        };
      else if (previous && "version" in previous)
        remaining[index] = { ...previous, version: block.version };
    }
    for (const item of selection.items) {
      const index = remaining.findLastIndex(
        (entry) =>
          (entry.kind === "copy" &&
            entry.items.some((record) => record.id === item.id)) ||
          (entry.kind === "item-edit" && entry.itemId === item.id),
      );
      const previous = remaining[index];
      if (previous?.kind === "copy")
        remaining[index] = {
          ...previous,
          items: previous.items.map((record) =>
            record.id === item.id ? item : record,
          ),
        };
      else if (previous?.kind === "item-edit")
        remaining[index] = { ...previous, version: item.version };
    }
    return remaining;
  }
  if (
    action.kind === "group-delete" ||
    action.kind === "item-edit" ||
    action.kind === "series" ||
    action.kind === "activity-create"
  )
    return remaining;
  if (!restored || action.kind === "create") return remaining;
  const index = remaining.findLastIndex(
    (entry) =>
      ("blockId" in entry && entry.blockId === action.blockId) ||
      ((entry.kind === "copy" || entry.kind === "series") &&
        entry.blocks.some((block) => block.id === action.blockId)),
  );
  const previous = remaining[index];
  if (previous?.kind === "copy" || previous?.kind === "series") {
    remaining[index] = {
      ...previous,
      blocks: previous.blocks.map((block) =>
        block.id === restored.id
          ? { id: restored.id, version: restored.version }
          : block,
      ),
    };
    return remaining;
  }
  if (
    previous &&
    "version" in previous &&
    previous.version === action.previousVersion
  )
    remaining[index] = { ...previous, version: restored.version };
  return remaining;
}

export type HistoryDirection = "undo" | "redo";
export type CalendarHistory = {
  actions: CalendarAction[];
  redo: CalendarAction[];
  seen: string[];
  pending: {
    direction: HistoryDirection;
    action: CalendarAction;
    key: string;
  } | null;
};
export const emptyHistory = (): CalendarHistory => ({
  actions: [],
  redo: [],
  seen: [],
  pending: null,
});
export function addHistoryAction(
  history: CalendarHistory,
  action: CalendarAction,
): CalendarHistory {
  if (history.seen.includes(action.key)) return history;
  return {
    ...history,
    actions: [...history.actions, action].slice(-100),
    redo: [],
    seen: [...history.seen, action.key].slice(-200),
  };
}

export function finishHistoryStep(
  history: CalendarHistory,
  direction: HistoryDirection,
  action: CalendarAction,
  inverse: CalendarAction | null,
  block: Block | null,
  selection?: RestoredSelection | null,
): CalendarHistory {
  const stack = direction === "undo" ? history.actions : history.redo;
  if (stack.at(-1)?.key !== action.key) return history;
  const remaining = undoAction(stack, action, block, selection);
  const other = [...(direction === "undo" ? history.redo : history.actions)];
  if (inverse) other.push(inverse);
  return {
    ...history,
    actions: direction === "undo" ? remaining : other,
    redo: direction === "redo" ? remaining : other,
    pending: null,
  };
}
