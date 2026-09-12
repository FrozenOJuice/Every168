import { z } from "zod";
import { workoutStartInput, idSchema, setInput } from "@168hours/contracts";
import { localTimeField } from "@/lib/format";
export const workoutSetForm = z
  .object({
    reps: setInput.shape.reps,
    weight: z.number().finite().min(0).max(4500).nullable(),
    durationSeconds: setInput.shape.durationSeconds,
    completed: setInput.shape.completed,
  })
  .refine((v) => v.reps !== null || v.durationSeconds !== null, {
    path: ["reps"],
    message: "Enter reps or a timed duration.",
  });
export function workoutFormSchema(timezone: string) {
  return z.object({
    ...workoutStartInput.shape,
    startedAt: localTimeField(timezone),
    endedAt: localTimeField(timezone).nullable(),
    exercises: z
      .array(
        z.object({
          id: idSchema.optional(),
          exerciseId: idSchema,
          exerciseNameSnapshot: z.string(),
          notes: z.string().max(4000).nullable(),
          sets: z.array(workoutSetForm).max(100),
        }),
      )
      .max(50),
  });
}
export type WorkoutFormValues = z.infer<ReturnType<typeof workoutFormSchema>>;
