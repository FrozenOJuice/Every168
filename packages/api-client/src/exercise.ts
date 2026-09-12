import type {
  Exercise,
  ExerciseInput,
  LibraryQuery,
  Workout,
  WorkoutSummary,
  WorkoutStartInput,
  WorkoutUpdateInput,
  Cardio,
  CardioInput,
  StrengthProgress,
  PageQuery,
  Page,
} from "@168hours/contracts";
import { body, query, type Http } from "./http";
export function exerciseClient(http: Http) {
  return {
    getExercises: (q: Partial<LibraryQuery> = {}) =>
      http<Page<Exercise>>("/api/v1/exercises" + query(q)),
    createExercise: (v: ExerciseInput) =>
      http<Exercise>("/api/v1/exercises", { method: "POST", body: body(v) }),
    updateExercise: (id: string, v: ExerciseInput) =>
      http<Exercise>("/api/v1/exercises/" + id, {
        method: "PUT",
        body: body(v),
      }),
    archiveExercise: (id: string) =>
      http<Exercise>("/api/v1/exercises/" + id + "/archive", {
        method: "POST",
        body: "{}",
      }),
    getStrengthProgress: (id: string, q: Partial<PageQuery> = {}) =>
      http<StrengthProgress>("/api/v1/strength-progress/" + id + query(q)),
    getWorkouts: (q: Partial<PageQuery> = {}) =>
      http<Page<WorkoutSummary>>("/api/v1/strength-workouts" + query(q)),
    startWorkout: (v: WorkoutStartInput) =>
      http<Workout>("/api/v1/strength-workouts", {
        method: "POST",
        body: body(v),
      }),
    getWorkout: (id: string) =>
      http<Workout>("/api/v1/strength-workouts/" + id),
    saveWorkout: (id: string, v: WorkoutUpdateInput) =>
      http<Workout>("/api/v1/strength-workouts/" + id, {
        method: "PUT",
        body: body(v),
      }),
    deleteWorkout: (id: string) =>
      http<{ ok: true }>("/api/v1/strength-workouts/" + id, {
        method: "DELETE",
      }),
    getCardio: (q: Partial<PageQuery> = {}) =>
      http<Page<Cardio>>("/api/v1/cardio-activities" + query(q)),
    logCardio: (v: CardioInput) =>
      http<Cardio>("/api/v1/cardio-activities", {
        method: "POST",
        body: body(v),
      }),
    updateCardio: (id: string, v: CardioInput) =>
      http<Cardio>("/api/v1/cardio-activities/" + id, {
        method: "PUT",
        body: body(v),
      }),
    deleteCardio: (id: string) =>
      http<{ ok: true }>("/api/v1/cardio-activities/" + id, {
        method: "DELETE",
      }),
  };
}
