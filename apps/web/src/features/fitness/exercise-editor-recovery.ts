"use client";

import { useLayoutEffect, useEffectEvent } from "react";
import { usePathname } from "next/navigation";
import { z } from "zod";
import { exerciseInput, exerciseSchema } from "@168hours/contracts";
import { useMe } from "@/features/identity/me";

export const exerciseEditorAttempt = z.object({
  input: exerciseInput,
  item: exerciseSchema.optional(),
});
export type ExerciseEditorAttempt = z.infer<typeof exerciseEditorAttempt>;

export function useExerciseEditorRecoveryKey() {
  const { user } = useMe();
  const pathname = usePathname();
  return `168hours:exercise-editor:${user.id}:${pathname}`;
}

export function useRecoverExerciseEditor(
  onRestore: (attempt: ExerciseEditorAttempt) => void,
) {
  const key = useExerciseEditorRecoveryKey();
  const restore = useEffectEvent(onRestore);
  useLayoutEffect(() => {
    try {
      const pending = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (!pending || !z.string().uuid().safeParse(pending.key).success) return;
      const parsed = exerciseEditorAttempt.safeParse(pending.variables);
      if (parsed.success) restore(parsed.data);
    } catch {
      // Invalid or unavailable recovery data cannot be replayed safely.
    }
  }, [key]);
}
