"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";
import { exerciseLoggingTypeSchema } from "@168hours/contracts";
import { planInput, type ExerciseDraft } from "./strength-draft";

export type BuilderDraft = {
  title: string;
  notes: string;
  exercises: ExerciseDraft[];
};
// Recovery accepts incomplete/invalid measurements; canonical validation still runs on Save.
const measurement = z.number().nullable();
const storedDraft = z.object({
  format: z.literal(1),
  version: z.number().int().positive().nullable(),
  draft: z.object({
    title: z.string(),
    notes: z.string(),
    exercises: z.array(
      z.object({
        exerciseId: z.string(),
        name: z.string(),
        clientKey: z.string().optional(),
        id: z.string().optional(),
        loggingType: exerciseLoggingTypeSchema.optional(),
        notes: z.string().nullable(),
        sets: z.array(
          z.object({
            id: z.string().optional(),
            clientKey: z.string().optional(),
            reps: measurement,
            weightKg: measurement,
            durationSeconds: measurement,
            targetReps: measurement,
            targetWeightKg: measurement,
            targetDurationSeconds: measurement,
            restSeconds: measurement,
            completed: z.boolean(),
            skipped: z.boolean(),
          }),
        ),
      }),
    ),
  }),
});
export function useWorkoutBuilderRecovery(
  storageKey: string,
  initial: BuilderDraft,
  baseline: string,
  version: number | null,
) {
  const [draft, setDraft] = useState(initial);
  const [recovered, setRecovered] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const current = useRef(initial);
  const baseVersion = useRef(version);
  const initialRef = useRef(initial);
  const signature = (value: BuilderDraft) =>
    JSON.stringify(
      planInput(value.title, value.notes || null, value.exercises),
    );
  const clear = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      setStorageError(true);
    }
  };
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
      current.current = stored.draft;
      baseVersion.current = stored.version;
      // Browser storage is unavailable during SSR; restore before the first interactive paint.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(stored.draft);
      setRecovered(true);
      setConflict(stored.version !== version);
    } catch {
      setStorageError(true);
    }
    // The builder is keyed by owner/workout/revision. Read once after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const change = (patch: Partial<BuilderDraft>) => {
    const next = { ...current.current, ...patch };
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
  const discard = () => {
    clear();
    current.current = initialRef.current;
    baseVersion.current = version;
    setDraft(initialRef.current);
    setRecovered(false);
    setConflict(false);
  };
  return { draft, change, clear, discard, recovered, conflict, storageError };
}
