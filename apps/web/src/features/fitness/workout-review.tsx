"use client";
import { ChevronDown, Info } from "lucide-react";
import { measurementsFor } from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { actualExerciseSummary } from "./workout-review-summary";
import { formatRestDuration, formatFitnessDuration } from "./rest-duration";
import { load, distance } from "./progress-shared";
import type { SessionDraft, ExerciseDraft, SetDraft } from "./strength-draft";

export function WorkoutReview({ value }: { value: SessionDraft }) {
  const { preferences } = useMe();
  const panel = useFitnessExercisePanel();
  const sets = value.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.completed && !set.skipped).length;
  const skipped = sets.filter((set) => set.skipped).length;
  const unfinished = sets.length - completed - skipped;
  const elapsed = value.endedAt
    ? Math.max(
        0,
        Math.round(
          (Date.parse(value.endedAt) - Date.parse(value.startedAt)) / 1000,
        ),
      )
    : 0;
  const formatSet = (exercise: ExerciseDraft, set: SetDraft) =>
    measurementsFor(
      set.measurementOverride ?? exercise.loggingType ?? "reps_load",
    )
      .map((field) => {
        if (field === "load")
          return set.weightKg === null
            ? "Load not recorded"
            : load(set.weightKg, preferences.weightUnit);
        if (field === "distance")
          return set.distanceMeters === null
            ? "Distance not recorded"
            : distance(set.distanceMeters, preferences.distanceUnit);
        if (field === "duration")
          return set.durationSeconds === null
            ? "Duration not recorded"
            : formatFitnessDuration(
                set.durationSeconds,
                preferences.durationUnit,
              );
        return set[field] === null
          ? `${field === "reps" ? "Reps" : "Laps"} not recorded`
          : `${set[field]} ${field}`;
      })
      .join(" · ");
  return (
    <section className="fitness-review form-stack" aria-label="Workout results">
      <div className="fitness-review-meta">
        <p>
          {new Intl.DateTimeFormat("en", {
            timeZone: preferences.timezone,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(value.startedAt))}{" "}
          <span className="muted">({preferences.timezone})</span>
        </p>
        <p>
          <strong>{formatRestDuration(elapsed)}</strong>{" "}
          <span aria-hidden="true">·</span> {value.exercises.length}{" "}
          {value.exercises.length === 1 ? "exercise" : "exercises"}
        </p>
        <p className="muted">
          {completed} completed {completed === 1 ? "set" : "sets"}
          {skipped ? ` · ${skipped} skipped` : ""}
          {unfinished ? ` · ${unfinished} unfinished` : ""}
        </p>
        {value.notes && <p className="fitness-review-note">{value.notes}</p>}
      </div>
      <div className="fitness-review-exercises">
        {value.exercises.map((exercise, index) => (
          <section
            className="fitness-review-exercise"
            key={exercise.clientKey ?? exercise.id ?? index}
            aria-label={`${exercise.name} results ${index + 1}`}
          >
            <details>
              <summary>
                <span>
                  <strong>{exercise.name}</strong>
                  <span className="fitness-review-result">
                    {actualExerciseSummary(exercise, preferences)}
                  </span>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <div className="fitness-review-set-list">
                {exercise.notes && (
                  <p className="muted fitness-review-note">{exercise.notes}</p>
                )}
                <ol aria-label={`${exercise.name} recorded sets`}>
                  {exercise.sets.map((set, i) => (
                    <li key={set.clientKey ?? set.id ?? i}>
                      <span className="muted">Set {i + 1}</span>
                      <span>
                        {set.skipped
                          ? "Skipped"
                          : set.completed
                            ? formatSet(exercise, set)
                            : "Unfinished"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
            <TooltipButton
              className="icon-button"
              tooltip="Exercise details"
              aria-label={`Help with ${exercise.name}`}
              onClick={() => panel.help(exercise.exerciseId)}
            >
              <Info size={18} aria-hidden="true" />
            </TooltipButton>
          </section>
        ))}
      </div>
    </section>
  );
}
