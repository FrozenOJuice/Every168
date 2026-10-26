import { z } from "zod";
import { exerciseLoggingTypeSchema } from "@168hours/contracts";

// Recovery validates structure, not save rules: incomplete/invalid edits must survive.
const measurement = z.number().nullable();
export const exerciseDraftSchema = z.object({
  exerciseId: z.string(),
  name: z.string(),
  clientKey: z.string().optional(),
  id: z.string().optional(),
  loggingType: exerciseLoggingTypeSchema.optional(),
  intentTags: z.array(z.string()).optional(),
  notes: z.string().nullable(),
  sets: z.array(
    z.object({
      id: z.string().optional(),
      clientKey: z.string().optional(),
      measurementOverride: exerciseLoggingTypeSchema.nullable().optional(),
      reps: measurement,
      weightKg: measurement,
      durationSeconds: measurement,
      distanceMeters: measurement.default(null),
      laps: measurement.default(null),
      targetReps: measurement,
      targetWeightKg: measurement,
      targetDurationSeconds: measurement,
      targetDistanceMeters: measurement.default(null),
      targetLaps: measurement.default(null),
      restSeconds: measurement,
      completed: z.boolean(),
      resultsEdited: z.boolean().default(false),
      skipped: z.boolean(),
    }),
  ),
});
