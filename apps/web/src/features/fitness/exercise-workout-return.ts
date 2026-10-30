import {
  exerciseLoggingTypeSchema,
  idSchema,
  type ExerciseLoggingType,
} from "@168hours/contracts";

export type ExerciseWorkoutOrigin = {
  exerciseId: string;
  mode: ExerciseLoggingType;
};
export type ExerciseWorkoutReturn = { exerciseId: string; href: string };

export function exerciseReturnPath(
  pathname: string,
  origin: ExerciseWorkoutOrigin,
) {
  const path =
    /^\/fitness\/exercises\/(?:[0-9a-f-]{36}|catalog\/[a-zA-Z0-9_-]+)$/.test(
      pathname,
    )
      ? pathname
      : `/fitness/exercises/${origin.exerciseId}`;
  return `${path}?${new URLSearchParams({ mode: origin.mode })}`;
}

export function parseExerciseWorkoutReturn(
  exerciseId: unknown,
  href: unknown,
): ExerciseWorkoutReturn | undefined {
  if (
    !idSchema.safeParse(exerciseId).success ||
    typeof href !== "string" ||
    href.length > 500 ||
    !href.startsWith("/fitness/exercises/")
  )
    return;
  const url = new URL(href, "https://168hours.invalid");
  if (
    url.origin !== "https://168hours.invalid" ||
    !/^\/fitness\/exercises\/(?:[0-9a-f-]{36}|catalog\/[a-zA-Z0-9_-]+)$/.test(
      url.pathname,
    )
  )
    return;
  if (
    !url.pathname.includes("/catalog/") &&
    url.pathname !== `/fitness/exercises/${exerciseId}`
  )
    return;
  const mode = exerciseLoggingTypeSchema.safeParse(
    url.searchParams.get("mode") ?? undefined,
  );
  const params = new URLSearchParams();
  if (mode.success) params.set("mode", mode.data);
  return {
    exerciseId: exerciseId as string,
    href: url.pathname + (params.size ? `?${params}` : ""),
  };
}

export function exerciseReturnPositionKey(
  userId: string,
  exerciseId: string,
  workoutId: string,
) {
  return `168hours:exercise-workout-return:${userId}:${exerciseId}:${workoutId}`;
}
