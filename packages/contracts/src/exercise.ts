import { z } from "zod";
import { blockSchema } from "./planning";
import {
  recordSchema,
  titleSchema,
  notesSchema,
  idSchema,
  instantSchema,
  pageSchema,
  pageQuerySchema,
} from "./common";
export const exerciseEquipmentOptions = [
  "Barbell",
  "Dumbbells",
  "Cable",
  "Machine",
  "Bodyweight",
  "Bench",
  "Kettlebell",
  "Resistance band",
  "Pull-up bar",
  "Other",
] as const;
export const exerciseMuscleOptions = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
] as const;
export const exerciseEquipmentSchema = z.enum(exerciseEquipmentOptions);
export const exerciseMuscleSchema = z.enum(exerciseMuscleOptions);
const equipmentList = z
  .array(exerciseEquipmentSchema)
  .max(exerciseEquipmentOptions.length)
  .refine(
    (values) => new Set(values).size === values.length,
    "Choose each item once.",
  );
const muscleList = z
  .array(exerciseMuscleSchema)
  .max(exerciseMuscleOptions.length)
  .refine(
    (values) => new Set(values).size === values.length,
    "Choose each muscle once.",
  );
// Intent is optional user metadata, independent of measurements or activity identity.
export const intentTagsSchema = z
  .array(z.string().trim().min(1).max(32))
  .max(8)
  .transform((tags) => [...new Set(tags.map((tag) => tag.toLowerCase()))]);
// Canonical measurement-set keys keep snapshots and history grouping deterministic.
// The UI selects individual measurements; these keys are not user-facing presets.
export const exerciseMeasurementOptions = [
  "reps",
  "load",
  "duration",
  "distance",
  "laps",
] as const;
export type ExerciseMeasurement = (typeof exerciseMeasurementOptions)[number];
export const exerciseLoggingTypeSchema = z.enum([
  "reps",
  "distance",
  "laps",
  "duration",
  "load",
  "reps_distance",
  "reps_laps",
  "reps_duration",
  "reps_load",
  "distance_laps",
  "distance_duration",
  "distance_load",
  "laps_duration",
  "laps_load",
  "duration_load",
  "reps_distance_laps",
  "reps_distance_duration",
  "reps_distance_load",
  "reps_laps_duration",
  "reps_laps_load",
  "reps_duration_load",
  "distance_laps_duration",
  "distance_laps_load",
  "distance_duration_load",
  "laps_duration_load",
  "reps_distance_laps_duration",
  "reps_distance_laps_load",
  "reps_distance_duration_load",
  "reps_laps_duration_load",
  "distance_laps_duration_load",
  "reps_distance_laps_duration_load",
]);
export type ExerciseLoggingType = z.infer<typeof exerciseLoggingTypeSchema>;
export function measurementsFor(
  type: ExerciseLoggingType,
): ExerciseMeasurement[] {
  return exerciseMeasurementOptions.filter((field) =>
    type.split("_").includes(field),
  );
}
export function measurementSetKey(
  fields: readonly ExerciseMeasurement[],
): ExerciseLoggingType {
  return exerciseLoggingTypeSchema.parse(
    ["reps", "distance", "laps", "duration", "load"]
      .filter((field) => fields.includes(field as ExerciseMeasurement))
      .join("_"),
  );
}
/** Matching selections inherit future exercise changes rather than staying detached. */
export function normalizeMeasurementOverride(
  override: ExerciseLoggingType | null | undefined,
  inherited: ExerciseLoggingType,
): ExerciseLoggingType | null {
  return override && override !== inherited ? override : null;
}
export const exerciseInput = z
  .object({
    name: titleSchema,
    notes: notesSchema,
    loggingType: exerciseLoggingTypeSchema.optional(),
    intentTags: intentTagsSchema.optional(),
    equipment: equipmentList.optional(),
    muscles: muscleList.optional(),
    favourite: z.boolean().optional(),
  })
  .strict();
export const exerciseSchema = recordSchema.extend({
  ...exerciseInput.shape,
  loggingType: exerciseLoggingTypeSchema,
  intentTags: intentTagsSchema,
  equipment: equipmentList,
  muscles: muscleList,
  archivedAt: instantSchema.nullable(),
  catalogKey: z.string().nullable(),
  favourite: z.boolean(),
  hidden: z.boolean(),
  source: z.enum(["system", "custom"]),
  canDelete: z.boolean(),
});
export const exerciseFavouriteInput = z
  .object({ favourite: z.boolean() })
  .strict();
export const exerciseHiddenInput = z.object({ hidden: z.boolean() }).strict();
export const exerciseDuplicateInput = z.union([
  z
    .object({
      catalogKey: z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9-]+$/),
    })
    .strict(),
  z
    .object({
      exerciseId: idSchema,
      version: z.number().int().positive().max(2147483647),
    })
    .strict(),
]);
export type ExerciseDuplicateInput = z.infer<typeof exerciseDuplicateInput>;
export const exerciseSortSchema = z.enum(["name_asc", "name_desc", "recent"]);
export type ExerciseSort = z.infer<typeof exerciseSortSchema>;
export const exerciseLibraryQuery = pageQuerySchema.extend({
  cursor: z.string().max(2000).optional(),
  sort: exerciseSortSchema.optional(),
  archived: z.enum(["true", "false"]).default("false"),
  search: z.string().trim().max(100).default(""),
  favourites: z.enum(["true", "false"]).optional(),
  equipment: z.preprocess(
    (value) => (typeof value === "string" ? value.split(",") : value),
    equipmentList.optional(),
  ),
  muscle: z.preprocess(
    (value) => (typeof value === "string" ? value.split(",") : value),
    muscleList.optional(),
  ),
});
export type ExerciseLibraryQuery = z.infer<typeof exerciseLibraryQuery>;
export const exerciseCatalogDefinitionSchema = z.object({
  key: z.string(),
  name: titleSchema,
  notes: notesSchema,
  equipment: exerciseEquipmentSchema,
  muscles: muscleList,
  loggingType: exerciseLoggingTypeSchema,
});
export const exerciseCatalogSchema = z.array(
  exerciseCatalogDefinitionSchema.extend({
    exercise: exerciseSchema.nullable(),
  }),
);
export const useCatalogExerciseInput = z
  .object({
    key: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
  })
  .strict();
export type ExerciseCatalogDefinition = z.infer<
  typeof exerciseCatalogDefinitionSchema
>;
export type ExerciseCatalogEntry = z.infer<
  typeof exerciseCatalogSchema
>[number];
export const setInput = z
  .object({
    resultsEdited: z.boolean().default(false),
    measurementOverride: exerciseLoggingTypeSchema.nullable().optional(),
    reps: z.number().int().positive().max(10000).nullable().default(null),
    weightKg: z.number().finite().min(0).max(2000).nullable().default(null),
    durationSeconds: z
      .number()
      .int()
      .positive()
      .max(86400)
      .nullable()
      .default(null),
    distanceMeters: z
      .number()
      .finite()
      .positive()
      .max(10000000)
      .nullable()
      .default(null),
    laps: z.number().int().positive().max(10000).nullable().default(null),
    completed: z.boolean().default(true),
    skipped: z.boolean().default(false),
    targetReps: z.number().int().positive().max(10000).nullable().default(null),
    targetWeightKg: z
      .number()
      .finite()
      .min(0)
      .max(2000)
      .nullable()
      .default(null),
    targetDurationSeconds: z
      .number()
      .int()
      .positive()
      .max(86400)
      .nullable()
      .default(null),
    targetDistanceMeters: z
      .number()
      .finite()
      .positive()
      .max(10000000)
      .nullable()
      .default(null),
    targetLaps: z.number().int().positive().max(10000).nullable().default(null),
    restSeconds: z.number().int().min(0).max(3600).nullable().default(null),
  })
  .strict()
  .refine(
    (v) =>
      !v.completed ||
      v.reps !== null ||
      v.weightKg !== null ||
      v.durationSeconds !== null ||
      v.distanceMeters !== null ||
      v.laps !== null,
    {
      path: ["reps"],
      message:
        "Enter actual reps, load, duration, distance or laps before completing a set.",
    },
  )
  .refine((v) => !(v.completed && v.skipped), {
    path: ["skipped"],
    message: "A skipped set cannot be completed.",
  });
export const plannedSetInput = z
  .object({
    measurementOverride: exerciseLoggingTypeSchema.nullable().optional(),
    targetReps: z.number().int().positive().max(10000).nullable().default(null),
    targetWeightKg: z
      .number()
      .finite()
      .min(0)
      .max(2000)
      .nullable()
      .default(null),
    targetDurationSeconds: z
      .number()
      .int()
      .positive()
      .max(86400)
      .nullable()
      .default(null),
    targetDistanceMeters: z
      .number()
      .finite()
      .positive()
      .max(10000000)
      .nullable()
      .default(null),
    targetLaps: z.number().int().positive().max(10000).nullable().default(null),
    restSeconds: z.number().int().min(0).max(3600).nullable().default(null),
  })
  .strict();
export const strengthPlanInput = z
  .object({
    title: z.string().trim().max(160),
    notes: notesSchema,
    isDraft: z.boolean().optional(),
    exercises: z
      .array(
        z
          .object({
            exerciseId: idSchema,
            loggingType: exerciseLoggingTypeSchema.optional(),
            intentTags: intentTagsSchema.optional(),
            notes: notesSchema,
            sets: z.array(plannedSetInput).max(100),
          })
          .strict(),
      )
      .max(50),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.isDraft) return;
    if (!v.title)
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Enter a workout title.",
      });
    if (!v.exercises.length)
      ctx.addIssue({
        code: "custom",
        path: ["exercises"],
        message: "Add at least one exercise.",
      });
    if (v.exercises.some((exercise) => !exercise.sets.length))
      ctx.addIssue({
        code: "custom",
        path: ["exercises"],
        message: "Add at least one set to each exercise.",
      });
  });
export const strengthPlanSchema = recordSchema.extend({
  title: titleSchema,
  notes: notesSchema,
  kind: z.enum(["workout", "scheduled"]),
  isDraft: z.boolean(),
  timeBlockId: idSchema.nullable(),
  sessionId: idSchema.nullable(),
  exercises: z.array(
    strengthPlanInput.shape.exercises.element.extend({
      name: titleSchema,
      loggingType: exerciseLoggingTypeSchema.default("reps_load"),
      intentTags: intentTagsSchema,
    }),
  ),
});
export const strengthPlanForBlockSchema = z.object({
  plan: strengthPlanSchema.nullable(),
});
export const strengthScheduleInput = z
  .object({
    startsAt: instantSchema,
    endsAt: instantSchema,
  })
  .strict()
  .refine(
    (v) =>
      Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
      Date.parse(v.endsAt) - Date.parse(v.startsAt) <= 31 * 86400000,
    { message: "Choose an end after start, within 31 days." },
  );
export const strengthBeginInput = z
  .object({ startedAt: instantSchema })
  .strict();
export const strengthPlanQuery = pageQuerySchema.extend({
  search: z.string().trim().max(160).default(""),
  kind: z.enum(["workout", "scheduled"]).default("workout"),
});
export type StrengthPlanInput = z.infer<typeof strengthPlanInput>;
export type StrengthPlan = z.infer<typeof strengthPlanSchema>;
export type StrengthPlanQuery = z.infer<typeof strengthPlanQuery>;
export const fitnessDayLinksSchema = z.object({ blockIds: z.array(idSchema) });
export type FitnessDayLinks = z.infer<typeof fitnessDayLinksSchema>;
export const nextStrengthWorkoutSchema = z.object({
  workout: z
    .object({ plan: strengthPlanSchema, block: blockSchema })
    .nullable(),
});
export type NextStrengthWorkout = z.infer<
  typeof nextStrengthWorkoutSchema
>["workout"];
export type StrengthScheduleInput = z.infer<typeof strengthScheduleInput>;

export const workoutExerciseInput = z
  .object({
    id: idSchema.optional(),
    exerciseId: idSchema,
    loggingType: exerciseLoggingTypeSchema.optional(),
    intentTags: intentTagsSchema.optional(),
    notes: notesSchema,
    sets: z.array(setInput.safeExtend({ id: idSchema.optional() })).max(100),
  })
  .strict();
export const workoutStartInput = z
  .object({
    title: titleSchema.default("Workout"),
    startedAt: instantSchema,
    notes: notesSchema,
    linkedTimeBlockId: idSchema.nullable().default(null),
  })
  .strict();
export const workoutUpdateInput = workoutStartInput
  .extend({
    endedAt: instantSchema.nullable(),
    exercises: z.array(workoutExerciseInput).max(50),
  })
  .refine(
    (v) =>
      v.endedAt === null ||
      (Date.parse(v.endedAt) > Date.parse(v.startedAt) &&
        Date.parse(v.endedAt) - Date.parse(v.startedAt) <= 31 * 86400000),
    {
      path: ["endedAt"],
      message: "Finish must be after start and within 31 days.",
    },
  )
  .refine(
    (v) =>
      v.endedAt === null ||
      v.exercises.some((e) => e.sets.some((s) => s.completed)),
    {
      path: ["exercises"],
      message: "Record at least one completed set before finishing.",
    },
  );
export const workoutSummarySchema = recordSchema.extend({
  ...workoutStartInput.shape,
  endedAt: instantSchema.nullable(),
});
export const setSchema = recordSchema.extend({
  ...setInput.shape,
  position: z.number(),
});
export const workoutStartingSetupSchema = z.object({
  title: titleSchema,
  notes: z.string().nullable(),
  exercises: z.array(
    z.object({
      id: idSchema,
      exerciseId: idSchema,
      exerciseNameSnapshot: z.string(),
      loggingType: exerciseLoggingTypeSchema,
      intentTags: intentTagsSchema,
      notes: z.string().nullable(),
      sets: z.array(plannedSetInput.extend({ id: idSchema })),
    }),
  ),
});
export type WorkoutStartingSetup = z.infer<typeof workoutStartingSetupSchema>;
export const workoutSchema = workoutSummarySchema.extend({
  startingSetup: workoutStartingSetupSchema.nullable(),
  exercises: z.array(
    z.object({
      id: idSchema,
      exerciseId: idSchema,
      exerciseNameSnapshot: z.string(),
      loggingType: exerciseLoggingTypeSchema,
      intentTags: intentTagsSchema,
      position: z.number(),
      notes: z.string().nullable(),
      sets: z.array(setSchema),
    }),
  ),
});
export const cardioInput = z
  .object({
    activityType: z.enum(["run", "walk", "swim", "cycle", "skip", "other"]),
    title: titleSchema.default("Cardio activity"),
    startedAt: instantSchema,
    durationSeconds: z
      .number()
      .int()
      .positive()
      .max(31 * 86400),
    distanceMeters: z
      .number()
      .finite()
      .positive()
      .max(10000000)
      .nullable()
      .default(null),
    notes: notesSchema,
    linkedTimeBlockId: idSchema.nullable().default(null),
  })
  .strict();
export const cardioSchema = recordSchema.extend({
  ...cardioInput.shape,
  paceSecondsPerKm: z.number().nullable(),
});
export const workoutHistoryQuery = pageQuerySchema.extend({
  search: z.string().trim().max(160).default(""),
  status: z.enum(["all", "active", "completed"]).default("all"),
});
export const cardioHistoryQuery = pageQuerySchema.extend({
  search: z.string().trim().max(160).default(""),
  activityType: cardioInput.shape.activityType.optional(),
});
export type WorkoutHistoryQuery = z.infer<typeof workoutHistoryQuery>;
export type CardioHistoryQuery = z.infer<typeof cardioHistoryQuery>;
export const strengthProgressQuery = pageQuerySchema.extend({
  excludeWorkoutId: idSchema.optional(),
});
export type StrengthProgressQuery = z.infer<typeof strengthProgressQuery>;
export const progressSetSchema = z.object({
  id: idSchema,
  createdAt: instantSchema,
  startedAt: instantSchema,
  workoutId: idSchema,
  exerciseNameSnapshot: z.string(),
  reps: z.number().nullable(),
  weightKg: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  distanceMeters: z.number().nullable(),
  laps: z.number().nullable(),
});
export const strengthProgressSchema = z.object({
  exercise: exerciseSchema,
  maxWeightKg: z.number().nullable(),
  history: pageSchema(progressSetSchema),
});
export type ExerciseInput = z.infer<typeof exerciseInput>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type SetInput = z.infer<typeof setInput>;
export type WorkoutStartInput = z.infer<typeof workoutStartInput>;
export type WorkoutUpdateInput = z.infer<typeof workoutUpdateInput>;
export type Workout = z.infer<typeof workoutSchema>;
export type WorkoutSummary = z.infer<typeof workoutSummarySchema>;
export type CardioInput = z.infer<typeof cardioInput>;
export type Cardio = z.infer<typeof cardioSchema>;
export type StrengthProgress = z.infer<typeof strengthProgressSchema>;
