"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Info, Pencil, Undo2 } from "lucide-react";
import { measurementsFor } from "@168hours/contracts";
import { fromKilograms, fromMeters } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { WorkoutNumberField } from "./workout-number-field";
import { RestBetweenSets } from "./rest-between-sets";
import { ExerciseRecall } from "./exercise-recall";
import { formatFitnessDuration } from "./rest-duration";
import { workoutExerciseSummary } from "./workout-exercise-summary";
import { useReorderList } from "./reorder-list";
import {
  actualKeys,
  canCompleteLiveSet,
  liveSetResults,
} from "./live-set-results";
import type { ExerciseDraft, SetDraft } from "./strength-draft";

type Props = {
  value: ExerciseDraft[];
  onChange: (value: ExerciseDraft[]) => void;
  disabled: boolean;
  sessionId: string;
  onRest: (seconds: number | null, exercise?: string) => void;
  errors?: Record<string, string>;
};

export function LiveWorkout({
  value,
  onChange,
  disabled,
  sessionId,
  onRest,
  errors = {},
}: Props) {
  const { root, rowProps, handle, feedback } = useReorderList(
    value,
    onChange,
    disabled,
  );
  return (
    <div className="fitness-live-workout">
      {!value.length && (
        <p className="muted">No exercises yet. Use Edit workout to add some.</p>
      )}
      <div className="fitness-live-exercise-list" ref={root}>
        {value.map((exercise, index) => (
          <section
            {...rowProps(index)}
            key={exercise.clientKey ?? exercise.id ?? index}
            className={`fitness-live-exercise panel ${rowProps(index).className ?? ""}`}
            aria-label={`${exercise.name} exercise ${index + 1}`}
          >
            <LiveExercise
              exercise={exercise}
              errors={errors}
              errorPrefix={`exercises.${index}`}
              disabled={disabled}
              sessionId={sessionId}
              onRest={onRest}
              handle={handle(index, `exercise ${index + 1}: ${exercise.name}`)}
              onChange={(next) =>
                onChange(value.map((item, i) => (i === index ? next : item)))
              }
            />
          </section>
        ))}
      </div>
      {feedback}
    </div>
  );
}

function LiveExercise({
  exercise,
  onChange,
  disabled,
  sessionId,
  onRest,
  handle,
  errors,
  errorPrefix,
}: {
  exercise: ExerciseDraft;
  onChange: (exercise: ExerciseDraft) => void;
  disabled: boolean;
  sessionId: string;
  onRest: Props["onRest"];
  handle: ReactNode;
  errors: Record<string, string>;
  errorPrefix: string;
}) {
  const { preferences } = useMe();
  const panel = useFitnessExercisePanel();
  const contentId = useId();
  const setHeading = useRef<HTMLHeadingElement>(null);
  const doneMessage = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const firstUnfinished = exercise.sets.findIndex(
    (set) => !set.completed && !set.skipped,
  );
  const active = firstUnfinished < 0 ? null : firstUnfinished;
  const [editing, setEditing] = useState<Set<number>>(() => new Set());
  const set = active === null ? undefined : exercise.sets[active];
  const isEditing =
    active !== null &&
    (editing.has(active) ||
      Object.keys(actualKeys).some(
        (field) =>
          errors[
            `${errorPrefix}.sets.${active}.${actualKeys[field as keyof typeof actualKeys]}`
          ],
      ));
  const mode = exercise.loggingType ?? "reps_load";
  const fields = set ? measurementsFor(set.measurementOverride ?? mode) : [];
  const results = set
    ? isEditing
      ? set
      : liveSetResults(set, mode)
    : undefined;
  const canComplete = !!results && canCompleteLiveSet(results);
  const completed = exercise.sets.filter((item) => item.completed).length;
  const skipped = exercise.sets.filter((item) => item.skipped).length;
  const labels = {
    reps: "Reps",
    load: `Load (${preferences.weightUnit})`,
    duration: "Time",
    distance: `Distance (${preferences.distanceUnit})`,
    laps: "Laps",
  };
  function update(next: SetDraft) {
    onChange({
      ...exercise,
      sets: exercise.sets.map((item, index) =>
        index === active ? next : item,
      ),
    });
  }
  function advance(skip: boolean) {
    if (!set || !results || active === null) return;
    // Skipping never records unconfirmed planned values.
    update({ ...(skip ? set : results), completed: !skip, skipped: skip });
    setEditing((previous) => {
      const next = new Set(previous);
      next.delete(active);
      return next;
    });
    const after = exercise.sets.findIndex(
      (item, i) => i > active && !item.completed && !item.skipped,
    );
    onRest(!skip && after >= 0 ? set.restSeconds : null, exercise.name);
    requestAnimationFrame(() =>
      (setHeading.current ?? doneMessage.current)?.focus({
        preventScroll: true,
      }),
    );
  }
  function undo(index: number) {
    onChange({
      ...exercise,
      sets: exercise.sets.map((item, i) =>
        i === index ? { ...item, completed: false, skipped: false } : item,
      ),
    });
    onRest(null);
    requestAnimationFrame(() =>
      setHeading.current?.focus({ preventScroll: true }),
    );
  }
  const activeEditor =
    set && results && active !== null ? (
      <section className="fitness-live-set" aria-label="Current set">
        <div className="fitness-live-set-heading">
          <h3 ref={setHeading} tabIndex={-1}>
            Set {active + 1}{" "}
            <span className="sr-only">of {exercise.sets.length}</span>
          </h3>
          <TooltipButton
            type="button"
            className="button fitness-live-edit-results"
            tooltip={isEditing ? "Done editing" : "Edit results"}
            aria-label={isEditing ? "Done editing" : "Edit results"}
            disabled={disabled || (isEditing && !canComplete)}
            onClick={() => {
              if (!isEditing) update({ ...results, resultsEdited: true });
              setEditing((previous) => {
                const next = new Set(previous);
                if (isEditing) next.delete(active);
                else next.add(active);
                return next;
              });
            }}
          >
            <Pencil size={14} aria-hidden="true" />
            <span className="sr-only">
              {isEditing ? "Done editing" : "Edit results"}
            </span>
          </TooltipButton>
        </div>
        {isEditing ? (
          <div className="fitness-live-fields">
            {fields.map((field) => (
              <WorkoutNumberField
                key={field}
                label={`Actual ${field === "load" ? `load (${preferences.weightUnit})` : field === "distance" ? `distance (${preferences.distanceUnit})` : field === "duration" ? "duration (seconds)" : field}`}
                displayLabel={
                  field === "duration" ? "Time (sec)" : labels[field]
                }
                value={set[actualKeys[field]]}
                error={
                  errors[`${errorPrefix}.sets.${active}.${actualKeys[field]}`]
                }
                weight={field === "load"}
                distance={field === "distance"}
                duration={field === "duration"}
                disabled={disabled}
                onChange={(value) =>
                  update({
                    ...set,
                    [actualKeys[field]]: value,
                    resultsEdited: true,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <dl className="fitness-live-results">
            {fields.map((field) => {
              const value = results[actualKeys[field]];
              const display =
                value === null
                  ? "—"
                  : field === "load"
                    ? Number(
                        fromKilograms(value, preferences.weightUnit).toFixed(3),
                      )
                    : field === "distance"
                      ? Number(
                          fromMeters(value, preferences.distanceUnit).toFixed(
                            3,
                          ),
                        )
                      : field === "duration"
                        ? formatFitnessDuration(value, preferences.durationUnit)
                        : value;
              return (
                <div key={field}>
                  <dt>{labels[field]}</dt>
                  <dd>{display}</dd>
                </div>
              );
            })}
          </dl>
        )}
        <div className="fitness-live-step-actions">
          <button
            type="button"
            className="button"
            disabled={disabled}
            aria-label="Skip set"
            onClick={() => advance(true)}
          >
            Skip
          </button>
          <button
            type="button"
            className="button primary"
            disabled={disabled || !canComplete}
            aria-label="Complete set"
            onClick={() => advance(false)}
          >
            <Check size={18} aria-hidden="true" />
            Complete
          </button>
        </div>
        {!canComplete && (
          <p className="fitness-live-hint">
            Edit results to enter at least one valid measurement.
          </p>
        )}
      </section>
    ) : null;
  return (
    <>
      <header className="fitness-live-exercise-header">
        {handle}
        <h2 aria-label={exercise.name}>
          <button
            className="fitness-live-exercise-toggle"
            type="button"
            aria-label={`${open ? "Collapse" : "Expand"} ${exercise.name} exercise`}
            aria-expanded={open}
            aria-controls={contentId}
            aria-describedby={`${contentId}-summary ${contentId}-progress`}
            onClick={() => setOpen(!open)}
          >
            <span className="fitness-live-exercise-title">
              <span>{exercise.name}</span>
              <span
                id={`${contentId}-summary`}
                className="fitness-exercise-target-summary"
              >
                {workoutExerciseSummary(exercise, preferences)}
              </span>
            </span>
            <span
              id={`${contentId}-progress`}
              className="fitness-live-exercise-progress"
              aria-label={`${completed} completed, ${skipped} skipped, ${exercise.sets.length - completed - skipped} remaining`}
            >
              {completed + skipped}/{exercise.sets.length}
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </h2>
        <TooltipButton
          type="button"
          className="icon-button"
          tooltip="Exercise details"
          aria-label={`Help with ${exercise.name}`}
          onClick={() => panel.help(exercise.exerciseId)}
        >
          <Info size={18} aria-hidden="true" />
        </TooltipButton>
      </header>
      <div
        id={contentId}
        className="fitness-exercise-body"
        data-collapsed={!open}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="fitness-exercise-body-clip">
          <div className="fitness-live-exercise-content">
            {exercise.notes && (
              <p className="fitness-live-note">{exercise.notes}</p>
            )}
            <ol
              className="fitness-live-set-stack"
              aria-label={`${exercise.name} sets`}
            >
              {exercise.sets.map((item, index) => {
                const status = item.completed
                  ? "Completed"
                  : item.skipped
                    ? "Skipped"
                    : index === active
                      ? "Current"
                      : "Upcoming";
                const displayed = item.completed
                  ? item
                  : liveSetResults(item, mode);
                const summary = measurementsFor(
                  item.measurementOverride ?? mode,
                )
                  .map((field) => {
                    const value = displayed[actualKeys[field]];
                    if (value === null) return `${labels[field]} —`;
                    if (field === "load")
                      return `${Number(fromKilograms(value, preferences.weightUnit).toFixed(3))} ${preferences.weightUnit}`;
                    if (field === "distance")
                      return `${Number(fromMeters(value, preferences.distanceUnit).toFixed(3))} ${preferences.distanceUnit}`;
                    if (field === "duration")
                      return formatFitnessDuration(
                        value,
                        preferences.durationUnit,
                      );
                    return `${value} ${field}`;
                  })
                  .join(" | ");
                return (
                  <li
                    key={item.clientKey ?? item.id ?? index}
                    className="fitness-live-stack-item"
                    aria-current={index === active ? "step" : undefined}
                  >
                    <div
                      className="fitness-live-stack-row"
                      data-state={status.toLowerCase()}
                    >
                      {index === active ? (
                        activeEditor
                      ) : (
                        <div className="fitness-live-stack-summary">
                          <div>
                            <h3>
                              Set {index + 1} <span>{status}</span>
                            </h3>
                            <p>{summary}</p>
                          </div>
                          {(item.completed || item.skipped) && (
                            <button
                              type="button"
                              className="button fitness-live-undo"
                              aria-label={`Undo ${item.completed ? "completion" : "skip"} of set ${index + 1}`}
                              disabled={disabled}
                              onClick={() => undo(index)}
                            >
                              <Undo2 size={15} aria-hidden="true" />
                              Undo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {index < exercise.sets.length - 1 && (
                      <RestBetweenSets
                        index={index}
                        value={item.restSeconds}
                        disabled={disabled}
                        onChange={(restSeconds) =>
                          onChange({
                            ...exercise,
                            sets: exercise.sets.map((entry, i) =>
                              i === index ? { ...entry, restSeconds } : entry,
                            ),
                          })
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ol>
            {active === null && (
              <p
                ref={doneMessage}
                tabIndex={-1}
                className="fitness-live-exercise-done"
                role="status"
              >
                {exercise.sets.length
                  ? `${completed} completed · ${skipped} skipped. Choose another exercise whenever you’re ready.`
                  : "Use Edit workout to add sets."}
              </p>
            )}
            {open && (
              <ExerciseRecall
                quietEmpty
                id={exercise.exerciseId}
                mode={set?.measurementOverride ?? mode}
                excludeWorkoutId={sessionId}
                onHistory={() =>
                  panel.help(
                    exercise.exerciseId,
                    true,
                    set?.measurementOverride ?? mode,
                  )
                }
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
