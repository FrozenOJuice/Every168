"use client";
import { Trash2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fromKilograms } from "@168hours/domain-utils";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { number } from "@/lib/format";
import { useMe } from "@/features/identity/me";
import { NotesField } from "./notes-field";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { emptySet, type ExerciseDraft } from "./strength-draft";
import { useReorderList } from "./reorder-list";
import { WorkoutSetRow } from "./workout-set-row";

export function WorkoutExerciseCard({
  exercise,
  session,
  sessionId,
  disabled,
  handle,
  onRest,
  onChange,
  onRemove,
}: {
  exercise: ExerciseDraft;
  session?: boolean;
  sessionId?: string;
  disabled: boolean;
  handle: ReactNode;
  onRest?: (seconds: number) => void;
  onChange: (exercise: ExerciseDraft) => void;
  onRemove: () => void;
}) {
  const panel = useFitnessExercisePanel();
  const unit = useMe().preferences.weightUnit;
  const {
    root: setListRef,
    rowProps,
    handle: setHandle,
    feedback,
  } = useReorderList(
    exercise.sets,
    (value) => onChange({ ...exercise, sets: value }),
    disabled,
  );
  const previous = useQuery({
    queryKey: ["fitness", "previous", exercise.exerciseId, sessionId],
    queryFn: () =>
      api.getStrengthProgress(exercise.exerciseId, {
        limit: 1,
        excludeWorkoutId: sessionId,
      }),
    enabled: !!session,
  });
  const last = previous.data?.history.items[0];
  return (
    <>
      <div className="fitness-workout-exercise-heading">
        {handle}
        <h2 aria-label={exercise.name}>
          <button
            type="button"
            className="fitness-exercise-name"
            aria-label={`Help with ${exercise.name}`}
            title="Exercise details"
            onClick={() => panel.help(exercise.exerciseId)}
          >
            {exercise.name}
          </button>
        </h2>
        <button
          type="button"
          className="icon-button fitness-remove-control"
          disabled={disabled}
          aria-label={`Remove ${exercise.name} exercise`}
          title="Remove exercise"
          onClick={onRemove}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
      {session && last && (
        <p className="fitness-previous-set">
          Previous completed set:{" "}
          {last.reps !== null ? `${last.reps} reps` : ""}
          {last.weightKg !== null
            ? ` · ${number(fromKilograms(last.weightKg, unit))} ${unit}`
            : ""}
          {last.durationSeconds !== null ? ` · ${last.durationSeconds}s` : ""}
        </p>
      )}
      {previous.error && (
        <p className="error" role="alert">
          Previous performance could not load.{" "}
          <button
            className="fitness-text-action"
            type="button"
            onClick={() => void previous.refetch()}
          >
            Retry history
          </button>
        </p>
      )}
      {!session && (
        <div className="fitness-planned-set-columns" aria-hidden="true">
          <span />
          <span>Set</span>
          <span>Reps</span>
          <span>Load ({unit})</span>
          <span />
          <span />
        </div>
      )}
      <div
        ref={setListRef}
        className={`fitness-workout-set-list${session ? " is-session" : ""}`}
      >
        {exercise.sets.map((set, index) => (
          <div
            {...rowProps(index)}
            key={set.id ?? set.clientKey ?? index}
            className={`fitness-workout-set${session ? " is-session" : ""}${set.completed ? " is-complete" : ""} ${rowProps(index).className ?? ""}`}
            role="group"
            aria-label={`Set ${index + 1}`}
          >
            <WorkoutSetRow
              set={set}
              index={index}
              session={session}
              disabled={disabled}
              handle={setHandle(index, `set ${index + 1}`)}
              onRest={onRest}
              onChange={(next) =>
                onChange({
                  ...exercise,
                  sets: exercise.sets.map((item, i) =>
                    i === index ? next : item,
                  ),
                })
              }
              onRemove={() => {
                onChange({
                  ...exercise,
                  sets: exercise.sets.filter((_, i) => i !== index),
                });
                requestAnimationFrame(() => {
                  const rows =
                    setListRef.current?.querySelectorAll<HTMLElement>(
                      ":scope > [data-reorder-item]",
                    );
                  const row = rows?.[Math.min(index, (rows?.length ?? 0) - 1)];
                  const target = Array.from(
                    row?.querySelectorAll<HTMLInputElement>("input") ?? [],
                  ).find(
                    (input) => input.getClientRects().length && !input.disabled,
                  );
                  (
                    target ??
                    setListRef.current?.parentElement?.querySelector<HTMLButtonElement>(
                      "[data-add-set]",
                    )
                  )?.focus({ preventScroll: true });
                });
              }}
            />
          </div>
        ))}
      </div>
      {feedback}
      <div className="fitness-workout-exercise-footer">
        <button
          type="button"
          data-add-set
          className="fitness-text-action"
          disabled={disabled || exercise.sets.length >= 100}
          onClick={() =>
            onChange({ ...exercise, sets: [...exercise.sets, emptySet()] })
          }
        >
          <Plus size={16} aria-hidden="true" />
          Add set
        </button>
        <details className="fitness-exercise-notes">
          <summary>{exercise.notes ? "Exercise notes" : "Add notes"}</summary>
          <NotesField
            label="Exercise notes"
            hideLabel
            disabled={disabled}
            value={exercise.notes}
            onChange={(notes) => onChange({ ...exercise, notes })}
          />
        </details>
      </div>
      {session && exercise.sets.length > 0 && (
        <button
          type="button"
          className="fitness-text-action"
          disabled={disabled}
          onClick={() =>
            onChange({
              ...exercise,
              sets: exercise.sets.map((set) => ({
                ...set,
                skipped: !set.completed,
              })),
            })
          }
        >
          Skip remaining sets
        </button>
      )}
    </>
  );
}
