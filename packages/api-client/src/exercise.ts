import type {
  StrengthPlan,
  StrengthPlanInput,
  StrengthPlanQuery,
  StrengthScheduleInput,
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
  StrengthProgressQuery,
  Page,
  WorkoutHistoryQuery,
  CardioHistoryQuery,
} from "@168hours/contracts";
import { writeHeaders, body, query, type Http } from "./http";
export function exerciseClient(http: Http) {
  return {
    getStrengthPlans: (q: Partial<StrengthPlanQuery> = {}) =>
      http<Page<StrengthPlan>>("/api/v1/strength-plans" + query(q)),
    getStrengthPlanForBlock: (id: string) =>
      http<{ plan: StrengthPlan | null }>(
        "/api/v1/strength-plan-for-block/" + id,
      ).then((result) => result.plan),
    getStrengthPlan: (id: string) =>
      http<StrengthPlan>("/api/v1/strength-plans/" + id),
    createStrengthPlan: (v: StrengthPlanInput, key?: string) =>
      http<StrengthPlan>("/api/v1/strength-plans", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateStrengthPlan: (
      id: string,
      v: StrengthPlanInput,
      version: number,
      key?: string,
    ) =>
      http<StrengthPlan>("/api/v1/strength-plans/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteStrengthPlan: (id: string, version: number, key?: string) =>
      http<{ ok: true }>("/api/v1/strength-plans/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    scheduleStrengthPlan: (
      id: string,
      v: StrengthScheduleInput,
      version: number,
      key?: string,
    ) =>
      http<StrengthPlan>("/api/v1/strength-plans/" + id + "/schedule", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    beginStrengthPlan: (
      id: string,
      startedAt: string,
      version: number,
      key?: string,
    ) =>
      http<Workout>("/api/v1/strength-plans/" + id + "/begin", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: body({ startedAt }),
      }),
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
    getStrengthProgress: (id: string, q: Partial<StrengthProgressQuery> = {}) =>
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
    repeatWorkout: (id: string, version: number, key?: string) =>
      http<Workout>("/api/v1/strength-workouts/" + id + "/repeat", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: "{}",
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
