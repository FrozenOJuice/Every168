"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";
import type { TrainingProgramInput } from "@168hours/contracts";
const stored = z.object({
  version: z.number().int().positive().nullable(),
  input: z.object({
    title: z.string(),
    notes: z.string().nullable(),
    startDate: z.string(),
    paused: z.boolean(),
    trainingDays: z.array(z.number()),
    steps: z.array(
      z.object({ id: z.string().optional(), workoutId: z.string() }),
    ),
  }),
});
export function recoverProgram(
  raw: string | null,
  initial: TrainingProgramInput,
  version: number | null,
) {
  try {
    const saved = stored.parse(JSON.parse(raw ?? "null"));
    if (
      JSON.stringify(saved.input) ===
      JSON.stringify(stored.shape.input.parse(initial))
    )
      return null;
    return { input: saved.input, conflict: saved.version !== version };
  } catch {
    return null;
  }
}
export function useProgramRecovery(
  key: string,
  initial: TrainingProgramInput,
  version: number | null,
) {
  const [draft, setDraft] = useState(initial);
  const [recovered, setRecovered] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const base = useRef({ initial, version });
  useLayoutEffect(() => {
    try {
      const value = recoverProgram(
        sessionStorage.getItem(key),
        base.current.initial,
        base.current.version,
      );
      if (value) {
        // Restore tab-local browser state before the first interactive paint.
        setDraft(value.input);
        setRecovered(true);
        setConflict(value.conflict);
      }
    } catch {
      setStorageError(true);
    }
  }, [key]);
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
      setStorageError(false);
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  }, [key]);
  const discard = useCallback(() => {
    if (!clear()) return false;
    setDraft(base.current.initial);
    setRecovered(false);
    setConflict(false);
    return true;
  }, [clear]);
  const dirty =
    JSON.stringify(stored.shape.input.parse(draft)) !==
    JSON.stringify(stored.shape.input.parse(initial));
  const change = (next: TrainingProgramInput) => {
    setDraft(next);
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ version: base.current.version, input: next }),
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  return {
    draft,
    dirty,
    change,
    clear,
    discard,
    recovered,
    conflict,
    storageError,
  };
}
