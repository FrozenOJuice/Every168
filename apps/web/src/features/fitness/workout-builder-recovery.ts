"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";
import { exerciseDraftSchema } from "./strength-draft-schema";
import { emptySet, planInput, type ExerciseDraft } from "./strength-draft";

export type BuilderDraft = {
  title: string;
  notes: string;
  exercises: ExerciseDraft[];
};
/** Every exercise needs an editable row, even when an incomplete draft has no sets. */
function editableDraft(draft: BuilderDraft): BuilderDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) =>
      exercise.sets.length
        ? exercise
        : {
            ...exercise,
            sets: [emptySet()],
          },
    ),
  };
}
const storedDraft = z.object({
  format: z.literal(1),
  version: z.number().int().positive().nullable(),
  draft: z.object({
    title: z.string(),
    notes: z.string(),
    exercises: z.array(exerciseDraftSchema),
  }),
});
export function useWorkoutBuilderRecovery(
  storageKey: string,
  initial: BuilderDraft,
  baseline: string,
  version: number | null,
) {
  const [draft, setDraft] = useState(() => editableDraft(initial));
  const [recovered, setRecovered] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const current = useRef(draft);
  const baseVersion = useRef(version);
  const initialRef = useRef(draft);
  const signature = (value: BuilderDraft) =>
    JSON.stringify(
      planInput(value.title, value.notes || null, value.exercises),
    );
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      setStorageError(true);
    }
  }, [storageKey]);
  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = storedDraft.safeParse(JSON.parse(raw));
      if (!parsed.success) return;
      const stored = parsed.data;
      // A successful save may have reached the server just before navigation/reload.
      if (signature(stored.draft) === baseline) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      const restored = editableDraft(stored.draft);
      current.current = restored;
      baseVersion.current = stored.version;
      // Browser storage is unavailable during SSR; restore before the first interactive paint.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(restored);
      setRecovered(true);
      setConflict(stored.version !== version);
    } catch {
      setStorageError(true);
    }
    // The builder is keyed by owner/workout/revision. Read once after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const change = (patch: Partial<BuilderDraft>) => {
    const next = editableDraft({ ...current.current, ...patch });
    current.current = next;
    setDraft(next);
    try {
      if (signature(next) === baseline) {
        sessionStorage.removeItem(storageKey);
        setRecovered(false);
        setConflict(false);
        baseVersion.current = version;
      } else {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            format: 1,
            version: baseVersion.current,
            draft: next,
          }),
        );
      }
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  const discard = useCallback(() => {
    clear();
    current.current = initialRef.current;
    baseVersion.current = version;
    setDraft(initialRef.current);
    setRecovered(false);
    setConflict(false);
  }, [clear, version]);
  return { draft, change, clear, discard, recovered, conflict, storageError };
}
