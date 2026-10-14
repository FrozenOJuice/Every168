import { useQueryClient } from "@tanstack/react-query";
import { uncertainWrite } from "@168hours/api-client";
import type {
  Block,
  BlockInput,
  BlockDeletion,
  CalendarItem,
  CalendarItemInput,
  SelectionMoveInput,
  GroupDeleteInput,
} from "@168hours/contracts";
import type { Dispatch, SetStateAction } from "react";
import { api } from "@/lib/api";
import { useCommand } from "@/lib/use-command";
import { invalidateCalendar } from "./invalidate-calendar";
import type { useCalendarHistory } from "./use-calendar-history";
import type { Preview, CalendarNotice } from "./calendar-interaction-types";
export function useCalendarInteractionCommands({
  history,
  setPreview,
  setStatus,
  clearSelectedPlans,
  setAdjusting,
  showNotice,
}: {
  history: ReturnType<typeof useCalendarHistory>;
  setPreview: Dispatch<SetStateAction<Preview | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  clearSelectedPlans: () => void;
  setAdjusting: Dispatch<SetStateAction<boolean>>;
  showNotice: (
    message: string,
    options?: { undoKey?: string; kind?: CalendarNotice["kind"] },
  ) => void;
}) {
  const cache = useQueryClient();
  const groupMove = useCommand({
    mutationFn: async (input: SelectionMoveInput, key: string) => {
      const result = await api.moveCalendarSelection(input, key);
      history.record({ key, kind: "group-edit", ...result });
      return result;
    },
    onSuccess: async () => {
      await invalidateCalendar(cache);
      setStatus("Plans moved.");
    },
  });
  const itemAdjust = useCommand({
    mutationFn: async (
      { item, input }: { item: CalendarItem; input: CalendarItemInput },
      key: string,
    ) => {
      const result = await api.updateCalendarItem(
        item.id,
        input,
        item.version,
        key,
      );
      history.record({
        key,
        kind: "item-edit",
        itemId: item.id,
        version: result.version,
        before: {
          title: item.title,
          notes: item.notes,
          categoryId: item.categoryId,
          goalId: item.goalId,
          kind: item.kind,
          date: item.date,
          endDate: item.endDate,
          isException: item.isException,
        },
        after: { ...input, isException: result.isException },
      });
      return result;
    },
    onSuccess: async () => {
      await invalidateCalendar(cache);
      setStatus("Plan updated.");
    },
  });
  const command = useCommand({
    mutationFn: (
      { block, input }: { block: Block; input: BlockInput },
      key: string,
    ) => {
      return api
        .updateTimeBlock(block.id, input, block.version, key)
        .then((result) => {
          history.record({
            key,
            kind: "edit",
            blockId: block.id,
            title: result.title,
            version: result.version,
            previousVersion: block.version,
            undoId: result.undoId,
          });
          return result;
        });
    },
    onSuccess: async () => {
      await invalidateCalendar(cache);
      setPreview(null);
      setStatus("Plan updated.");
    },
    onError: (error) => {
      if (!uncertainWrite(error)) {
        setPreview(null);
        setStatus("");
      }
    },
  });
  const remove = useCommand<
    BlockDeletion & { title: string; key: string },
    Block
  >({
    mutationFn: async (block, key) => {
      const result = await api.deleteTimeBlock(block.id, block.version, key);
      history.record({
        key,
        kind: "delete",
        blockId: block.id,
        title: block.title,
        previousVersion: block.version,
        undoId: result.undoId,
      });
      return { ...result, title: block.title, key };
    },
    onSuccess: async ({ key }) => {
      await invalidateCalendar(cache);
      clearSelectedPlans();
      setAdjusting(false);
      setStatus("Plan deleted.");
      showNotice("Plan deleted", { undoKey: key, kind: "change" });
    },
    onError: (error) => {
      if (!uncertainWrite(error)) setStatus("");
    },
  });
  const groupDelete = useCommand<
    { ok: true; undoId: string; key: string; count: number },
    GroupDeleteInput
  >({
    mutationFn: async (input, key) => {
      const result = await api.deleteCalendarSelection(input, key);
      history.record({ kind: "group-delete", key, undoId: result.undoId });
      return { ...result, key, count: input.plans.length };
    },
    onSuccess: async ({ key, count }) => {
      await invalidateCalendar(cache);
      clearSelectedPlans();
      const message = count === 1 ? "Plan deleted" : "Plans deleted";
      setStatus(`${message}.`);
      showNotice(message, { undoKey: key, kind: "change" });
    },
  });
  return { groupMove, itemAdjust, command, remove, groupDelete };
}
