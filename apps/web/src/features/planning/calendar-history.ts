import type { Block } from "@168hours/contracts";

export type CalendarAction =
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
    };

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
) {
  if (history.at(-1)?.key !== action.key) return history;
  const remaining = history.slice(0, -1);
  if (action.kind === "copy") return remaining;
  if (!restored || action.kind === "create") return remaining;
  const index = remaining.findLastIndex(
    (entry) => "blockId" in entry && entry.blockId === action.blockId,
  );
  const previous = remaining[index];
  if (
    previous &&
    "version" in previous &&
    previous.version === action.previousVersion
  )
    remaining[index] = { ...previous, version: restored.version };
  return remaining;
}
