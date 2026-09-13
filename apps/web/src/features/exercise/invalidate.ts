import type { QueryClient } from "@tanstack/react-query";
import { invalidateCalendar } from "@/features/planning/invalidate-calendar";
export async function invalidateExercise(cache: QueryClient) {
  await Promise.all([
    invalidateCalendar(cache),
    ...["workouts", "workout", "cardio", "progress"].map((key) =>
      cache.invalidateQueries({ queryKey: [key] }),
    ),
  ]);
}
