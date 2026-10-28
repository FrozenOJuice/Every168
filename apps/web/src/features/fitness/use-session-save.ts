"use client";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, uncertainWrite } from "@168hours/api-client";
import { workoutUpdateInput, type Workout } from "@168hours/contracts";
import { api } from "@/lib/api";
import { sessionInput } from "./strength-draft";
import type { SessionDraftState, SessionSaveAttempt } from "./session-recovery";

export function useSessionSave({
  id,
  recovered,
  onAttempt,
  onSuccess,
  onFailure,
}: {
  id: string;
  recovered?: SessionSaveAttempt;
  onAttempt: (attempt: SessionSaveAttempt) => void;
  onSuccess: (saved: Workout, attempt: SessionSaveAttempt) => void;
  onFailure: (error: Error, uncertain: boolean) => void;
}) {
  const attempt = useRef(recovered);
  const running = useRef(false);
  const [restored, setRestored] = useState(!!recovered);
  const mutation = useMutation({
    mutationFn: (v: SessionSaveAttempt) =>
      api.saveWorkout(
        id,
        workoutUpdateInput.parse(sessionInput(v.input)),
        v.version,
        v.key,
      ),
    onSuccess: (saved, submitted) => {
      attempt.current = undefined;
      setRestored(false);
      onSuccess(saved, submitted);
    },
    onError: (error: Error) => {
      const uncertain = uncertainWrite(error);
      if (!uncertain) {
        attempt.current = undefined;
        setRestored(false);
      }
      onFailure(error, uncertain);
    },
    onSettled: () => {
      running.current = false;
    },
    retry: false,
  });
  const needsRetry = restored || uncertainWrite(mutation.error);
  return {
    error:
      mutation.error ??
      (restored
        ? new Error("Confirm the previous save before continuing.")
        : null),
    isPending: mutation.isPending || needsRetry,
    retrying: mutation.isPending,
    needsRetry,
    reset: mutation.reset,
    conflict:
      mutation.error instanceof ApiError &&
      mutation.error.code === "STALE_REVISION",
    mutate(draft: SessionDraftState) {
      if (running.current || attempt.current) return;
      const next = {
        input: draft.input,
        version: draft.version,
        key: crypto.randomUUID(),
      };
      attempt.current = next;
      running.current = true;
      onAttempt(next);
      mutation.mutate(next);
    },
    retry() {
      if (running.current || !attempt.current) return;
      running.current = true;
      mutation.mutate(attempt.current);
    },
  };
}
