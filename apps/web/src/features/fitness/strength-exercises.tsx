"use client";
import { useRef, useLayoutEffect, useCallback } from "react";
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
  onRest,
  disabled = false,
}: {
  value: ExerciseDraft[];
  onChange: (v: ExerciseDraft[]) => void;
  session?: boolean;
  sessionId?: string;
  building?: boolean;
  onRest?: (seconds: number) => void;
  disabled?: boolean;
}) {
  const { register, pick } = useFitnessExercisePanel();
  const current = useRef({ value, onChange, disabled });
  useLayoutEffect(() => {
    current.current = { value, onChange, disabled };
  }, [value, onChange, disabled]);
  const addExercise = useCallback(
    (exercise: import("@168hours/contracts").Exercise) => {
      const latest = current.current;
      if (latest.disabled || latest.value.length >= 50) return false;
      latest.onChange([
        ...latest.value,
        {
          clientKey: crypto.randomUUID(),
          exerciseId: exercise.id,
          name: exercise.name,
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
      {building && !value.length && (
        <p className="fitness-builder-empty">Add exercises from the library.</p>
      )}
      <div ref={exerciseListRef} className="fitness-workout-exercise-list">
        {value.map((exercise, index) => (
          <section
            {...rowProps(index)}
            key={
              exercise.id ??
              exercise.clientKey ??
              `${exercise.exerciseId}:${index}`
            }
            className={`fitness-exercise fitness-compact-exercise ${rowProps(index).className ?? ""}`}
            aria-label={`${exercise.name} exercise ${index + 1}`}
          >
            <WorkoutExerciseCard
              exercise={exercise}
              session={session}
              sessionId={sessionId}
              disabled={disabled}
              onRest={onRest}
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
      <button
        type="button"
        className={`button${building ? " fitness-builder-add-exercise" : ""}`}
        disabled={disabled || value.length >= 50}
        data-add-exercise
        onClick={() => pick()}
      >
        Add exercise
      </button>
    </div>
  );
}
