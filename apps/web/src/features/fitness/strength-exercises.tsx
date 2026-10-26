"use client";
import { useRef, useLayoutEffect, useCallback, useId, useState } from "react";
import { Plus } from "lucide-react";
import { workoutCreationExperiment } from "./workout-creation-experiment";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { emptySet, type ExerciseDraft } from "./strength-draft";
import { WorkoutExerciseCard } from "./workout-exercise-card";
import { useReorderList } from "./reorder-list";

export function StrengthExercises({
  value,
  onChange,
  session,
  sessionId,
  building = false,
  initiallyCollapsed = false,
  errors = {},
  onRest,
  onNotice,
  disabled = false,
}: {
  value: ExerciseDraft[];
  onChange: (v: ExerciseDraft[]) => void;
  session?: boolean;
  sessionId?: string;
  building?: boolean;
  initiallyCollapsed?: boolean;
  errors?: Record<string, string>;
  onRest?: (seconds: number) => void;
  onNotice?: (message: string) => void;
  disabled?: boolean;
}) {
  const errorId = useId();
  const [addedExerciseKeys, setAddedExerciseKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const { register, pick } = useFitnessExercisePanel();
  const current = useRef({ value, onChange, disabled });
  useLayoutEffect(() => {
    current.current = { value, onChange, disabled };
  }, [value, onChange, disabled]);
  const addExercise = useCallback(
    (exercise: import("@168hours/contracts").Exercise) => {
      const latest = current.current;
      if (latest.disabled || latest.value.length >= 50) return false;
      const clientKey = crypto.randomUUID();
      setAddedExerciseKeys((keys) => new Set(keys).add(clientKey));
      latest.onChange([
        ...latest.value,
        {
          clientKey,
          exerciseId: exercise.id,
          name: exercise.name,
          loggingType: exercise.loggingType,
          intentTags: exercise.intentTags,
          notes: null,
          sets: [emptySet()],
        },
      ]);
      return true;
    },
    [],
  );
  useLayoutEffect(() => register(addExercise), [register, addExercise]);
  const update = (index: number, e: ExerciseDraft) =>
    onChange(value.map((item, i) => (i === index ? e : item)));
  const {
    root: exerciseListRef,
    rowProps,
    handle,
    feedback,
  } = useReorderList(value, onChange, disabled);
  return (
    <div className="fitness-workout-exercises">
      {building && workoutCreationExperiment && !value.length && (
        <div
          className="fitness-builder-empty fitness-builder-library-hint"
          tabIndex={-1}
          data-validation-error={!!errors.exercises}
          aria-describedby={errors.exercises ? errorId : undefined}
        >
          Choose exercises from the library to add them to your workout.
        </div>
      )}
      {building && !workoutCreationExperiment && !value.length && (
        <button
          type="button"
          className="fitness-builder-empty"
          data-validation-error={!!errors.exercises}
          aria-describedby={errors.exercises ? errorId : undefined}
          data-add-exercise
          disabled={disabled}
          onClick={() => pick()}
        >
          <Plus size={24} aria-hidden="true" />
          Add exercise
        </button>
      )}
      {errors.exercises && (
        <p id={errorId} className="error" role="alert">
          {errors.exercises}
        </p>
      )}
      <div ref={exerciseListRef} className="fitness-workout-exercise-list">
        {value.map((exercise, index) => (
          <section
            {...rowProps(index)}
            key={
              exercise.clientKey ??
              exercise.id ??
              `${exercise.exerciseId}:${index}`
            }
            className={`fitness-exercise fitness-compact-exercise ${rowProps(index).className ?? ""}`}
            aria-label={`${exercise.name} exercise ${index + 1}`}
          >
            <WorkoutExerciseCard
              exercise={exercise}
              collapsible={building}
              initiallyCollapsed={
                initiallyCollapsed &&
                !addedExerciseKeys.has(exercise.clientKey ?? "")
              }
              errors={errors}
              errorPrefix={`exercises.${index}`}
              session={session}
              sessionId={sessionId}
              disabled={disabled}
              onRest={onRest}
              onNotice={onNotice}
              handle={handle(index, `exercise ${index + 1}: ${exercise.name}`)}
              onChange={(next) => update(index, next)}
              onRemove={() => {
                onChange(value.filter((_, i) => i !== index));
                requestAnimationFrame(() => {
                  const rows =
                    exerciseListRef.current?.querySelectorAll<HTMLElement>(
                      ":scope > section",
                    );
                  const target = rows?.[
                    Math.min(index, (rows?.length ?? 0) - 1)
                  ]?.querySelector<HTMLButtonElement>(".fitness-exercise-name");
                  const add =
                    exerciseListRef.current?.parentElement?.querySelector<HTMLButtonElement>(
                      "[data-add-exercise]",
                    );
                  (
                    target ??
                    (add?.getClientRects().length ? add : null) ??
                    exerciseListRef.current
                      ?.closest("form")
                      ?.querySelector<HTMLInputElement>("input")
                  )?.focus({ preventScroll: true });
                });
              }}
            />
          </section>
        ))}
      </div>
      {feedback}
      {(!building || (!workoutCreationExperiment && value.length > 0)) && (
        <button
          type="button"
          className={`button${building ? " fitness-builder-add-exercise" : ""}`}
          disabled={disabled || value.length >= 50}
          data-add-exercise
          onClick={() => pick()}
        >
          Add exercise
        </button>
      )}
    </div>
  );
}
