import { z } from "zod";
import {
  workoutStartInput,
  idSchema,
  setInput,
  type Workout,
} from "@168hours/contracts";
import { fromKilograms } from "@168hours/domain-utils";
import { localTimeField } from "@/lib/format";
const workoutSetForm = (weightUnit: "kg" | "lb") =>
  z
    .object({
      id: idSchema.optional(),
      reps: setInput.shape.reps,
      weight: z
        .number()
        .finite()
        .min(0)
        .max(fromKilograms(2000, weightUnit))
        .nullable(),
      durationSeconds: setInput.shape.durationSeconds,
      completed: setInput.shape.completed,
    })
    .refine((v) => v.reps !== null || v.durationSeconds !== null, {
      path: ["reps"],
      message: "Enter reps or a timed duration.",
    });
export function workoutFormSchema(
  timezone: string,
  weightUnit: "kg" | "lb",
  recorded?: Pick<Workout, "startedAt" | "endedAt">,
) {
  return z.object({
    ...workoutStartInput.shape,
    startedAt: localTimeField(timezone, recorded?.startedAt),
    endedAt: localTimeField(timezone, recorded?.endedAt).nullable(),
    exercises: z
      .array(
        z.object({
          id: idSchema.optional(),
          exerciseId: idSchema,
          exerciseNameSnapshot: z.string(),
          notes: z.string().max(4000).nullable(),
          sets: z.array(workoutSetForm(weightUnit)).max(100),
        }),
      )
      .max(50),
  });
}
export type WorkoutFormValues = z.infer<ReturnType<typeof workoutFormSchema>>;
