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
};
const storedSession = z.object({
  input: z.object({
    title: z.string(),
    notes: z.string().nullable(),
    startedAt: instantSchema,
    endedAt: instantSchema.nullable(),
    linkedTimeBlockId: idSchema.nullable(),
    exercises: z.array(exerciseDraftSchema),
  }),
  version: z.number().int().positive(),
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
      !Object.keys(stored.invalidTimes ?? {}).length &&
      JSON.stringify(sessionInput(stored.input)) ===
        JSON.stringify(sessionInput(fresh.input))
    )
      return fresh;
    return {
      ...stored,
      dirty: true,
      conflict: stored.version !== session.version,
    };
  } catch {
    return fresh;
  }
}
