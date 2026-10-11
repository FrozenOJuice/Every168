"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Block } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand } from "@/lib/use-command";
import { invalidateCalendar } from "./invalidate-calendar";
import {
  recordAction,
  undoAction,
  type CalendarAction,
} from "./calendar-history";

export function useCalendarHistory(
  onUndone: (block: Block | null, action: CalendarAction) => void,
) {
  const [actions, setActions] = useState<CalendarAction[]>([]);
  const recorded = useRef(new Set<string>());
  const cache = useQueryClient();
  const command = useCommand({
    mutationFn: async (action: CalendarAction, key: string) => {
      if (action.kind === "group-delete")
        return {
          action,
          block: null,
          selection: await api.undoCalendarSelectionDelete(
            { undoId: action.undoId },
            key,
          ),
        };
      const block =
        action.kind === "copy"
          ? (await api.undoCalendarCopy(
              { blocks: action.blocks, items: action.items },
              key,
            ),
            null)
          : action.kind === "delete"
            ? await api.restoreTimeBlock(action.undoId, key)
            : action.kind === "edit"
              ? await api.undoTimeBlockEdit(action.undoId, action.version, key)
              : (await api.deleteTimeBlock(action.blockId, action.version, key),
                null);
      return { action, block, selection: null };
    },
    onSuccess: async ({ action, block, selection }) => {
      setActions((history) => undoAction(history, action, block, selection));
      await invalidateCalendar(cache);
      onUndone(block, action);
    },
  });
  return {
    actions,
    command,
    record(action: CalendarAction) {
      // Successful retries retain their request key, even after that action was undone.
      if (recorded.current.has(action.key)) return;
      recorded.current.add(action.key);
      setActions((history) => recordAction(history, action));
    },
    undo() {
      const action = actions.at(-1);
      if (action) command.mutate(action);
    },
  };
}
