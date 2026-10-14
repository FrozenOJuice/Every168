"use client";
import { NotesField } from "./notes-field";
import { useState, useId } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { fromKilograms, toKilograms } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { number } from "@/lib/format";
import { Dialog } from "@/components/ui/dialog";
import { ExerciseLibrary } from "./exercise-library";
import {
  emptySet,
  move,
  type ExerciseDraft,
  type SetDraft,
} from "./strength-draft";

export function StrengthExercises({
  value,
  onChange,
  session,
  sessionId,
  onRest,
  disabled = false,
}: {
  value: ExerciseDraft[];
  onChange: (v: ExerciseDraft[]) => void;
  session?: boolean;
  sessionId?: string;
  onRest?: (seconds: number) => void;
  disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const update = (index: number, e: ExerciseDraft) =>
    onChange(value.map((item, i) => (i === index ? e : item)));
  return (
    <div className="form-stack">
      {value.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id ?? `${exercise.exerciseId}:${index}`}
          exercise={exercise}
          index={index}
          session={session}
          sessionId={sessionId}
          disabled={disabled}
          onRest={onRest}
          onChange={(e) => update(index, e)}
          onRemove={() => onChange(value.filter((_, i) => i !== index))}
          onMove={(delta) => onChange(move(value, index, delta))}
          count={value.length}
        />
      ))}
      <button
        type="button"
        className="button"
        disabled={disabled || value.length >= 50}
        onClick={() => setPicking(true)}
      >
        Add exercise
      </button>
      {picking &&
        createPortal(
          <Dialog title="Choose an exercise" onClose={() => setPicking(false)}>
            <ExerciseLibrary
              onChoose={(e) => {
                onChange([
                  ...value,
                  {
                    exerciseId: e.id,
                    name: e.name,
                    notes: null,
                    sets: [emptySet()],
                  },
                ]);
                setPicking(false);
              }}
            />
          </Dialog>,
          document.body,
        )}
    </div>
  );
}
function ExerciseCard({
  exercise,
  index,
  session,
  sessionId,
  disabled,
  onRest,
  onChange,
  onRemove,
  onMove,
  count,
}: {
  exercise: ExerciseDraft;
  index: number;
  session?: boolean;
  sessionId?: string;
  disabled: boolean;
  onRest?: (seconds: number) => void;
  onChange: (e: ExerciseDraft) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  count: number;
}) {
  const unit = useMe().preferences.weightUnit;
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
  const update = (i: number, set: SetDraft) =>
    onChange({
      ...exercise,
      sets: exercise.sets.map((s, n) => (n === i ? set : s)),
    });
  return (
    <section
      className="panel fitness-exercise"
      aria-label={`${exercise.name} exercise ${index + 1}`}
    >
      <div className="row between">
        <h2>
          {index + 1}. {exercise.name}
        </h2>
        <div className="row">
          <button
            className="button"
            type="button"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move exercise ${index + 1} up`}
          >
            ↑
          </button>
          <button
            className="button"
            type="button"
            disabled={disabled || index === count - 1}
            onClick={() => onMove(1)}
            aria-label={`Move exercise ${index + 1} down`}
          >
            ↓
          </button>
          <button
            className="button"
            type="button"
            disabled={disabled}
            onClick={onRemove}
          >
            Remove exercise
          </button>
        </div>
      </div>
      {session && last && (
        <p className="text-small">
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
            className="button"
            type="button"
            onClick={() => void previous.refetch()}
          >
            Retry history
          </button>
        </p>
      )}
      <NotesField
        label="Exercise notes"
        disabled={disabled}
        value={exercise.notes}
        onChange={(notes) => onChange({ ...exercise, notes })}
      />
      <div className="form-stack">
        {exercise.sets.map((set, i) => (
          <div
            className={`fitness-set${set.completed ? " is-complete" : ""}`}
            key={set.id ?? i}
            role="group"
            aria-label={`Set ${i + 1}`}
          >
            <div className="row between">
              <strong>Set {i + 1}</strong>
              <div className="row">
                <button
                  className="button"
                  type="button"
                  disabled={disabled || i === 0}
                  onClick={() =>
                    onChange({ ...exercise, sets: move(exercise.sets, i, -1) })
                  }
                  aria-label={`Move set ${i + 1} up`}
                >
                  ↑
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={disabled || i === exercise.sets.length - 1}
                  onClick={() =>
                    onChange({ ...exercise, sets: move(exercise.sets, i, 1) })
                  }
                  aria-label={`Move set ${i + 1} down`}
                >
                  ↓
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...exercise,
                      sets: exercise.sets.filter((_, n) => n !== i),
                    })
                  }
                >
                  Remove set
                </button>
              </div>
            </div>
            <div className="fitness-set-fields">
              <NumberField
                label="Target reps"
                value={set.targetReps}
                disabled={disabled}
                onChange={(v) => update(i, { ...set, targetReps: v })}
              />
              <NumberField
                label={`Target load (${unit})`}
                value={set.targetWeightKg}
                weight
                disabled={disabled}
                onChange={(v) => update(i, { ...set, targetWeightKg: v })}
              />
              <NumberField
                label="Target duration (seconds)"
                value={set.targetDurationSeconds}
                disabled={disabled}
                onChange={(v) =>
                  update(i, { ...set, targetDurationSeconds: v })
                }
              />
              <NumberField
                label="Rest (seconds)"
                value={set.restSeconds}
                min={0}
                disabled={disabled}
                onChange={(v) => update(i, { ...set, restSeconds: v })}
              />
            </div>
            {session && (
              <>
                <div className="fitness-set-fields">
                  <NumberField
                    label="Actual reps"
                    value={set.reps}
                    disabled={disabled}
                    onChange={(v) => update(i, { ...set, reps: v })}
                  />
                  <NumberField
                    label={`Actual load (${unit})`}
                    weight
                    value={set.weightKg}
                    disabled={disabled}
                    onChange={(v) => update(i, { ...set, weightKg: v })}
                  />
                  <NumberField
                    label="Actual duration (seconds)"
                    value={set.durationSeconds}
                    disabled={disabled}
                    onChange={(v) => update(i, { ...set, durationSeconds: v })}
                  />
                </div>
                <div className="row">
                  <label className="fitness-check">
                    <input
                      type="checkbox"
                      disabled={
                        disabled ||
                        set.skipped ||
                        (set.reps === null && set.durationSeconds === null)
                      }
                      checked={set.completed}
                      onChange={(e) => {
                        update(i, { ...set, completed: e.target.checked });
                        if (e.target.checked && set.restSeconds)
                          onRest?.(set.restSeconds);
                      }}
                    />
                    Completed
                  </label>
                  <label className="fitness-check">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={set.skipped}
                      onChange={(e) =>
                        update(i, {
                          ...set,
                          skipped: e.target.checked,
                          completed: false,
                        })
                      }
                    />
                    Skipped
                  </label>
                  {!set.completed && !set.skipped && (
                    <span className="muted text-small">Unfinished</span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="button"
        disabled={disabled || exercise.sets.length >= 100}
        onClick={() =>
          onChange({ ...exercise, sets: [...exercise.sets, emptySet()] })
        }
      >
        Add set
      </button>
      {session && exercise.sets.length > 0 && (
        <button
          type="button"
          className="button"
          disabled={disabled}
          onClick={() =>
            onChange({
              ...exercise,
              sets: exercise.sets.map((s) => ({
                ...s,
                completed: s.completed,
                skipped: !s.completed,
              })),
            })
          }
        >
          Skip remaining sets
        </button>
      )}
    </section>
  );
}
function NumberField({
  label,
  value,
  onChange,
  disabled,
  weight = false,
  min = 1,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
  weight?: boolean;
  min?: number;
}) {
  const id = useId();
  const unit = useMe().preferences.weightUnit;
  const display =
    value === null
      ? ""
      : weight
        ? Number(fromKilograms(value, unit).toFixed(6))
        : value;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={weight ? "any" : 1}
        min={weight ? 0 : min}
        disabled={disabled}
        value={display}
        onChange={(e) =>
          onChange(
            e.target.value === ""
              ? null
              : weight
                ? toKilograms(Number(e.target.value), unit)
                : Number(e.target.value),
          )
        }
      />
    </div>
  );
}
