"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { ToastNotice } from "@/components/ui/toast";
import type { ExerciseDraft } from "./strength-draft";

/** Undo merges into the current occurrence, without reverting later edits. */
export function useSetRemovalUndo({
  exercise,
  disabled,
  enabled,
  onChange,
  onNotice,
  onRestore,
  list,
}: {
  exercise: ExerciseDraft;
  disabled: boolean;
  enabled: boolean;
  onChange: (exercise: ExerciseDraft) => void;
  onNotice?: (message: string, action?: ToastNotice["action"]) => void;
  onRestore: () => void;
  list: RefObject<HTMLDivElement | null>;
}) {
  const current = useRef({
    exercise,
    disabled,
    enabled,
    onChange,
    onNotice,
    onRestore,
  });
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    current.current = {
      exercise,
      disabled,
      enabled,
      onChange,
      onNotice,
      onRestore,
    };
  }, [exercise, disabled, enabled, onChange, onNotice, onRestore]);
  return (index: number) => {
    if (!enabled || !onNotice) return;
    const removed = structuredClone(exercise.sets[index]!);
    removed.clientKey ??= crypto.randomUUID();
    const previousKey = exercise.sets[index - 1]?.clientKey;
    const nextKey = exercise.sets[index + 1]?.clientKey;
    let restored = false;
    const undo = () => {
      const latest = current.current;
      if (!mounted.current || latest.disabled || !latest.enabled || restored)
        return;
      if (latest.exercise.sets.length >= 100) {
        latest.onNotice?.(
          "Exercise has 100 sets. Remove a set before undoing.",
          { label: "Undo", onClick: undo },
        );
        return;
      }
      const sets = [...latest.exercise.sets];
      const nextIndex = nextKey
        ? sets.findIndex((set) => set.clientKey === nextKey)
        : -1;
      const previousIndex = previousKey
        ? sets.findIndex((set) => set.clientKey === previousKey)
        : -1;
      const insertAt =
        nextIndex >= 0
          ? nextIndex
          : previousIndex >= 0
            ? previousIndex + 1
            : Math.min(index, sets.length);
      sets.splice(insertAt, 0, removed);
      restored = true;
      latest.onRestore();
      latest.onChange({ ...latest.exercise, sets });
      requestAnimationFrame(() => {
        const row = Array.from(
          list.current?.querySelectorAll<HTMLElement>(
            "[data-set-occurrence]",
          ) ?? [],
        ).find((item) => item.dataset.setOccurrence === removed.clientKey);
        row?.scrollIntoView({ block: "nearest", inline: "nearest" });
        const input = Array.from(
          row?.querySelectorAll<HTMLInputElement>("input") ?? [],
        ).find((item) => item.getClientRects().length && !item.disabled);
        (input ?? row)?.focus({ preventScroll: true });
      });
    };
    onNotice(`Set ${index + 1} removed from ${exercise.name}.`, {
      label: "Undo",
      onClick: undo,
    });
  };
}
