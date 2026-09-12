import type { QueryClient } from "@tanstack/react-query";
export async function invalidateExercise(cache: QueryClient) {
  await Promise.all(
    ["workouts", "workout", "cardio", "progress", "week", "dashboard"].map(
      (key) => cache.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
