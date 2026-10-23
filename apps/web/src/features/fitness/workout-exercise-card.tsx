"use client";
import { Trash2, Plus, X, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  load,
  distance,
  sessionDate,
  volumeText,
  trackingLabels,
} from "./progress-shared";
import {
  useRef,
  useState,
  useLayoutEffect,
  useId,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { NotesField } from "./notes-field";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { emptySet, nextPlannedSet, type ExerciseDraft } from "./strength-draft";
import { useReorderList } from "./reorder-list";
import { exerciseTrackingFields } from "./exercise-tracking";
import { exerciseLoggingTypeSchema } from "@168hours/contracts";
import { FitnessSelect } from "./fitness-select";
import { IntentTagsField } from "./intent-tags-field";
import { WorkoutSetRow } from "./workout-set-row";

export function WorkoutExerciseCard({
  exercise,
  collapsible = false,
  errors = {},
  errorPrefix = "",
  session,
  sessionId,
  disabled,
  handle,
  onRest,
  onChange,
  onRemove,
}: {
  exercise: ExerciseDraft;
  collapsible?: boolean;
  errors?: Record<string, string>;
  errorPrefix?: string;
  session?: boolean;
  sessionId?: string;
  disabled: boolean;
  handle: ReactNode;
  onRest?: (seconds: number) => void;
  onChange: (exercise: ExerciseDraft) => void;
  onRemove: () => void;
}) {
  const panel = useFitnessExercisePanel();
  const [collapsed, setCollapsed] = useState(false);
  const contentId = useId();
  const setErrorId = useId();
  const hasErrors = Object.entries(errors).some(
    ([key, error]) => error && key.startsWith(`${errorPrefix}.`),
  );
  if (collapsed && hasErrors) setCollapsed(false);
  const [notesOpen, setNotesOpen] = useState(false);
  if (!notesOpen && errors[`${errorPrefix}.notes`]) setNotesOpen(true);
  const notesRef = useRef<HTMLDivElement>(null);
  const notesButtonRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (notesOpen) notesRef.current?.querySelector("textarea")?.focus();
  }, [notesOpen]);
  const { weightUnit: unit, distanceUnit, timezone } = useMe().preferences;
  const loggingType = exercise.loggingType ?? "reps_load";
  const mainFields = exerciseTrackingFields[loggingType];
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
    queryKey: [
      "fitness",
      "previous-session",
      exercise.exerciseId,
      sessionId,
      loggingType,
    ],
    queryFn: () =>
      api.getExerciseReport(exercise.exerciseId, {
        loggingType,
        limit: 1,
        excludeWorkoutId: sessionId,
      }),
    enabled: !!session,
  });
  const last = previous.data?.sessions.items[0];
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
        {collapsible && (
          <button
            type="button"
            className="icon-button fitness-exercise-collapse"
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${exercise.name} exercise`}
            aria-expanded={!collapsed}
            aria-controls={contentId}
            title={collapsed ? "Expand exercise" : "Collapse exercise"}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        )}
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
      {collapsed && (
        <p className="fitness-collapsed-exercise-summary">
          {exercise.sets.length} {exercise.sets.length === 1 ? "set" : "sets"}
          {exercise.notes ? " · Note" : ""}
        </p>
      )}
      <div
        id={contentId}
        className="fitness-exercise-fields"
        data-logging-type={loggingType}
        hidden={collapsed}
      >
        <div className="fitness-exercise-metadata">
          <FitnessSelect
            label={`Measurements for ${exercise.name}`}
            value={loggingType}
            searchable={false}
            disabled={disabled}
            options={Object.entries(trackingLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={(value) =>
              onChange({
                ...exercise,
                loggingType: exerciseLoggingTypeSchema.parse(value),
              })
            }
          />
          <IntentTagsField
            label={`Intent for ${exercise.name}`}
            value={exercise.intentTags ?? []}
            disabled={disabled}
            onChange={(intentTags) => onChange({ ...exercise, intentTags })}
          />
        </div>
        {session && last && (
          <div className="fitness-previous-set">
            <Link href={`/fitness/session/${last.id}`}>
              Latest finished session · {sessionDate(last.startedAt, timezone)}
            </Link>
            <p>
              {last.completedSets} completed sets
              {last.maxReps !== null ? ` · Best reps: ${last.maxReps}` : ""}
              {last.maxWeightKg !== null
                ? ` · Highest load: ${load(last.maxWeightKg, unit)}`
                : ""}
              {last.maxDistanceMeters !== null
                ? ` · Distance: ${distance(last.maxDistanceMeters, distanceUnit)}`
                : ""}
              {last.maxLaps !== null ? ` · Laps: ${last.maxLaps}` : ""}
              {last.maxDurationSeconds !== null
                ? ` · Longest set: ${last.maxDurationSeconds} sec`
                : ""}
            </p>
            {loggingType === "reps_load" && (
              <p>Volume: {volumeText(last, unit)}</p>
            )}
            <Link href={`/fitness/progress/${exercise.exerciseId}`}>
              Progress and records →
            </Link>
          </div>
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
          <div
            className="fitness-planned-set-columns fitness-numbered-set-columns"
            aria-hidden="true"
          >
            <span>Set</span>
            {mainFields.map((field) => (
              <span key={field}>
                {field === "reps"
                  ? "Reps"
                  : field === "load"
                    ? `Load (${unit})`
                    : field === "distance"
                      ? `Distance (${distanceUnit})`
                      : field === "laps"
                        ? "Laps"
                        : "Time (sec)"}
              </span>
            ))}
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
                loggingType={loggingType}
                hasNextSet={index < exercise.sets.length - 1}
                session={session}
                disabled={disabled}
                errors={errors}
                errorPrefix={`${errorPrefix}.sets.${index}`}
                handle={setHandle(
                  index,
                  `set ${index + 1}`,
                  session ? `Set ${index + 1}` : index + 1,
                )}
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
                    const row =
                      rows?.[Math.min(index, (rows?.length ?? 0) - 1)];
                    const target = Array.from(
                      row?.querySelectorAll<HTMLInputElement>("input") ?? [],
                    ).find(
                      (input) =>
                        input.getClientRects().length && !input.disabled,
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
            data-validation-error={!!errors[`${errorPrefix}.sets`]}
            aria-describedby={
              errors[`${errorPrefix}.sets`] ? setErrorId : undefined
            }
            className="fitness-text-action"
            disabled={disabled || exercise.sets.length >= 100}
            onClick={() =>
              onChange({
                ...exercise,
                sets: [
                  ...exercise.sets,
                  collapsible
                    ? nextPlannedSet(exercise.sets.at(-1))
                    : emptySet(),
                ],
              })
            }
          >
            <Plus size={16} aria-hidden="true" />
            Add set
          </button>
          {!notesOpen && (
            <button
              ref={notesButtonRef}
              type="button"
              className="fitness-text-action"
              disabled={disabled}
              onClick={() => setNotesOpen(true)}
            >
              {exercise.notes ? "Exercise notes" : "Add notes"}
            </button>
          )}
        </div>
        {errors[`${errorPrefix}.sets`] && (
          <p id={setErrorId} className="error" role="alert">
            {errors[`${errorPrefix}.sets`]}
          </p>
        )}
        {notesOpen && (
          <div
            ref={notesRef}
            className="fitness-exercise-note-editor"
            role="group"
            aria-label={`Exercise note for ${exercise.name}`}
          >
            <div className="fitness-exercise-note-heading">
              <span>Exercise note</span>
              <button
                type="button"
                className="icon-button fitness-remove-control"
                aria-label={`Remove note from ${exercise.name}`}
                title="Remove note"
                disabled={disabled}
                onClick={() => {
                  onChange({ ...exercise, notes: null });
                  setNotesOpen(false);
                  requestAnimationFrame(() => notesButtonRef.current?.focus());
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <NotesField
              label="Exercise notes"
              hideLabel
              disabled={disabled}
              value={exercise.notes}
              error={errors[`${errorPrefix}.notes`]}
              onChange={(notes) => onChange({ ...exercise, notes })}
            />
          </div>
        )}
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
      </div>
    </>
  );
}
