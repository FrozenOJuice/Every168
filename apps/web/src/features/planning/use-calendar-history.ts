"use client";
import { useHydrated } from "@/lib/use-hydrated";
import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Block } from "@168hours/contracts";
import { uncertainWrite } from "@168hours/api-client";
import { useMe } from "@/features/identity/me";
import { useCommand } from "@/lib/use-command";
import { invalidateCalendar } from "./invalidate-calendar";
import {
  addHistoryAction,
  finishHistoryStep,
  type CalendarAction,
  type HistoryDirection,
} from "./calendar-history";
import { applyHistoryAction } from "./calendar-history-executor";
import {
  calendarHistoryReady,
  getCalendarHistory,
  initializeCalendarHistory,
  historyIsPersistent,
  subscribeCalendarHistory,
  updateCalendarHistory,
} from "./calendar-history-store";

type Intent = {
  action: CalendarAction;
  direction: HistoryDirection;
  key?: string;
};
export function useCalendarHistory(
  onApplied: (
    block: Block | null,
    action: CalendarAction,
    direction: HistoryDirection,
  ) => void,
) {
  const { user } = useMe();
  const owner = user.id;
  const hydrated = useHydrated();
  const history = useSyncExternalStore(
    subscribeCalendarHistory,
    () => getCalendarHistory(owner),
    () => getCalendarHistory(""),
  );
  useEffect(() => {
    initializeCalendarHistory(owner);
    return () => {
      if (!calendarHistoryReady(owner)) return;
      updateCalendarHistory(owner, (state) => ({
        ...state,
        actions: state.actions.filter(
          (action) =>
            historyIsPersistent(action) ||
            action.key === state.pending?.action.key,
        ),
        redo: state.redo.filter(
          (action) =>
            historyIsPersistent(action) ||
            action.key === state.pending?.action.key,
        ),
      }));
    };
  }, [owner]);
  const cache = useQueryClient();
  const command = useCommand({
    mutationFn: async (intent: Intent, generatedKey: string) => {
      const key = intent.key ?? generatedKey;
      updateCalendarHistory(owner, (state) => ({
        ...state,
        pending: { ...intent, key },
      }));
      return { ...intent, ...(await applyHistoryAction(intent.action, key)) };
    },
    onError: (error) => {
      if (!uncertainWrite(error))
        updateCalendarHistory(owner, (state) => ({ ...state, pending: null }));
    },
    onSuccess: async ({ action, direction, inverse, block, selection }) => {
      updateCalendarHistory(owner, (state) =>
        finishHistoryStep(state, direction, action, inverse, block, selection),
      );
      await invalidateCalendar(cache);
      if (action.kind === "activity-create")
        await Promise.all(
          [
            "nutrition",
            "water",
            "weight",
            "workouts",
            "workout",
            "cardio",
            "progress",
          ].map((name) => cache.invalidateQueries({ queryKey: [name] })),
        );
      onApplied(block, action, direction);
    },
  });
  const pending = history.pending;
  const recovered = pending !== null && !command.isPending;
  function step(direction: HistoryDirection) {
    if (!calendarHistoryReady(owner) || getCalendarHistory(owner).pending)
      return;
    const state = getCalendarHistory(owner);
    const action = (direction === "undo" ? state.actions : state.redo).at(-1);
    if (action) command.mutate({ action, direction });
  }
  return {
    actions: history.actions,
    redoActions: history.redo,
    command: {
      ...command,
      isPending:
        command.isPending ||
        pending !== null ||
        !hydrated ||
        !calendarHistoryReady(owner),
      error:
        command.error ??
        (recovered
          ? new Error(
              "A previous undo or redo needs to finish. Retry to confirm its result.",
            )
          : null),
      needsRetry: command.needsRetry || recovered,
      retry() {
        if (command.needsRetry) command.retry();
        else if (pending) command.mutate(pending);
      },
    },
    record(action: CalendarAction) {
      updateCalendarHistory(owner, (state) => addHistoryAction(state, action));
    },
    undo() {
      step("undo");
    },
    redo() {
      step("redo");
    },
  };
}
