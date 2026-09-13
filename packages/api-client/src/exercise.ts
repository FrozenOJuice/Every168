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
  WorkoutHistoryQuery,
  CardioHistoryQuery,
} from "@168hours/contracts";
import { writeHeaders, body, query, type Http } from "./http";
export function exerciseClient(http: Http) {
  return {
    getExercises: (q: Partial<LibraryQuery> = {}) =>
      http<Page<Exercise>>("/api/v1/exercises" + query(q)),
    createExercise: (v: ExerciseInput, key?: string) =>
      http<Exercise>("/api/v1/exercises", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateExercise: (
      id: string,
      v: ExerciseInput,
      version: number,
      key?: string,
    ) =>
      http<Exercise>("/api/v1/exercises/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    archiveExercise: (id: string, version: number, key?: string) =>
      http<Exercise>("/api/v1/exercises/" + id + "/archive", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    getStrengthProgress: (id: string, q: Partial<PageQuery> = {}) =>
      http<StrengthProgress>("/api/v1/strength-progress/" + id + query(q)),
    restoreExercise: (id: string, version: number, key?: string) =>
      http<Exercise>("/api/v1/exercises/" + id + "/restore", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    getWorkouts: (q: Partial<WorkoutHistoryQuery> = {}) =>
      http<Page<WorkoutSummary>>("/api/v1/strength-workouts" + query(q)),
    startWorkout: (v: WorkoutStartInput, key?: string) =>
      http<Workout>("/api/v1/strength-workouts", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    getWorkout: (id: string) =>
      http<Workout>("/api/v1/strength-workouts/" + id),
    saveWorkout: (
      id: string,
      v: WorkoutUpdateInput,
      version: number,
      key?: string,
    ) =>
      http<Workout>("/api/v1/strength-workouts/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteWorkout: (id: string, version: number, key?: string) =>
      http<{ ok: true }>("/api/v1/strength-workouts/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    getCardio: (q: Partial<CardioHistoryQuery> = {}) =>
      http<Page<Cardio>>("/api/v1/cardio-activities" + query(q)),
    logCardio: (v: CardioInput, key?: string) =>
      http<Cardio>("/api/v1/cardio-activities", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateCardio: (id: string, v: CardioInput, version: number, key?: string) =>
      http<Cardio>("/api/v1/cardio-activities/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteCardio: (id: string, version: number, key?: string) =>
      http<{ ok: true }>("/api/v1/cardio-activities/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
  };
}
