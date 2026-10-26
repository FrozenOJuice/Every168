import { z } from "zod";
import { instantSchema, idSchema, type Workout } from "@168hours/contracts";
import { exerciseDraftSchema } from "./strength-draft-schema";
import {
  sessionDraft,
  sessionInput,
  type SessionDraft,
} from "./strength-draft";

export type InvalidSessionTimes = Partial<
  Record<"startedAt" | "endedAt", string>
>;
export type SessionDraftState = {
  input: SessionDraft;
  version: number;
  dirty: boolean;
  conflict: boolean;
  invalidTimes?: InvalidSessionTimes;
  pending?: SessionSaveAttempt;
};
const draftInput = z.object({
  title: z.string(),
  notes: z.string().nullable(),
  startedAt: instantSchema,
  endedAt: instantSchema.nullable(),
  linkedTimeBlockId: idSchema.nullable(),
  exercises: z.array(exerciseDraftSchema),
});
export type SessionSaveAttempt = {
  input: SessionDraft;
  version: number;
  key: string;
};
const storedSession = z.object({
  input: draftInput,
  version: z.number().int().positive(),
  pending: z
    .object({
      input: draftInput,
      version: z.number().int().positive(),
      key: z.string().uuid(),
    })
    .optional(),
  invalidTimes: z
    .object({
      startedAt: z.string().optional(),
      endedAt: z.string().optional(),
    })
    .optional(),
});
export function recoverSession(
  raw: string | null,
  session: Workout,
): SessionDraftState {
  const fresh: SessionDraftState = {
    input: sessionDraft(session),
    version: session.version,
    dirty: false,
    conflict: false,
  };
  try {
    const stored = storedSession.parse(JSON.parse(raw ?? "null"));
    if (
      !stored.pending &&
      !Object.keys(stored.invalidTimes ?? {}).length &&
      JSON.stringify(sessionInput(stored.input)) ===
        JSON.stringify(sessionInput(fresh.input))
    )
      return fresh;
    return {
      ...stored,
      dirty: true,
      conflict: !stored.pending && stored.version !== session.version,
    };
  } catch {
    return fresh;
  }
}

/** Reconcile server-assigned identities against the submitted occurrences, never
 * against the current order: edits and reorders may have happened in flight. */
export function acceptSessionSave(
  current: SessionDraftState,
  attempt: SessionSaveAttempt,
  saved: Workout,
): SessionDraftState {
  const same =
    JSON.stringify(sessionInput(current.input)) ===
    JSON.stringify(sessionInput(attempt.input));
  const input = same ? sessionDraft(saved) : current.input;
  const exercises = input.exercises.map((exercise, index) => {
    const submittedIndex = same
      ? index
      : attempt.input.exercises.findIndex(
          (e) => (e.clientKey ?? e.id) === (exercise.clientKey ?? exercise.id),
        );
    const submitted = attempt.input.exercises[submittedIndex];
    const confirmed = saved.exercises[submittedIndex];
    if (!submitted || !confirmed) return exercise;
    return {
      ...exercise,
      id: confirmed.id,
      clientKey: submitted.clientKey ?? confirmed.id,
      sets: exercise.sets.map((set, setIndex) => {
        const i = same
          ? setIndex
          : submitted.sets.findIndex(
              (s) => (s.clientKey ?? s.id) === (set.clientKey ?? set.id),
            );
        const result = confirmed.sets[i];
        return result
          ? {
              ...set,
              id: result.id,
              clientKey: submitted.sets[i]?.clientKey ?? result.id,
            }
          : set;
      }),
    };
  });
  return {
    input: { ...input, exercises },
    version: saved.version,
    dirty: !same || !!Object.keys(current.invalidTimes ?? {}).length,
    conflict: false,
    invalidTimes: current.invalidTimes,
  };
}
