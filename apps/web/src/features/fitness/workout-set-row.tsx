"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { fromKilograms } from "@168hours/domain-utils";
import type { ExerciseLoggingType } from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { number } from "@/lib/format";
import type { SetDraft } from "./strength-draft";
import { WorkoutNumberField as NumberField } from "./workout-number-field";
import {
  exerciseTrackingFields,
  type ExerciseMeasurement,
} from "./exercise-tracking";
import { RestBetweenSets } from "./rest-between-sets";

export function WorkoutSetRow({
  set,
  index,
  loggingType = "reps_load",
  hasNextSet = false,
  errors = {},
  errorPrefix = "",
  session,
  disabled,
  handle,
  onChange,
  onRemove,
  onRest,
}: {
  set: SetDraft;
  index: number;
  loggingType?: ExerciseLoggingType;
  hasNextSet?: boolean;
  errors?: Record<string, string>;
  errorPrefix?: string;
  session?: boolean;
  disabled: boolean;
  handle: ReactNode;
  onChange: (set: SetDraft) => void;
  onRemove: () => void;
  onRest?: (seconds: number) => void;
}) {
  const unit = useMe().preferences.weightUnit;
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const main = exerciseTrackingFields[loggingType];
  const secondary = (["reps", "load", "duration"] as const).filter(
    (field) => !main.includes(field),
  );
  const keys = {
    reps: "targetReps",
    load: "targetWeightKg",
    duration: "targetDurationSeconds",
  } as const;
  const actualKeys = {
    reps: "reps",
    load: "weightKg",
    duration: "durationSeconds",
  } as const;
  const labels = {
    reps: "reps",
    load: `load (${unit})`,
    duration: "duration (seconds)",
  };
  const messages = {
    reps: "Use whole reps from 1 to 10,000, or leave blank.",
    load: `Use a load from 0 to ${number(fromKilograms(2000, unit))} ${unit}, or leave blank.`,
    duration: "Use whole seconds from 1 to 86,400, or leave blank.",
  };
  const restError = errors[`${errorPrefix}.restSeconds`]
    ? "Use whole seconds from 0 to 3,600, or leave blank."
    : undefined;
  if (
    !expanded &&
    secondary.some((field) => errors[`${errorPrefix}.${keys[field]}`])
  )
    setExpanded(true);
  const measurement = (
    field: ExerciseMeasurement,
    actual = false,
    hideLabel = false,
  ) => {
    const key = actual ? actualKeys[field] : keys[field];
    return (
      <NumberField
        key={key}
        label={`${actual ? "Actual" : "Target"} ${labels[field]}`}
        hideLabel={hideLabel}
        value={set[key]}
        weight={field === "load"}
        disabled={disabled}
        error={
          !actual && errors[`${errorPrefix}.${key}`]
            ? messages[field]
            : undefined
        }
        onChange={(value) => onChange({ ...set, [key]: value })}
      />
    );
  };
  const remove = (
    <button
      type="button"
      className="icon-button fitness-remove-control"
      aria-label={`Remove set ${index + 1}`}
      title="Remove set"
      disabled={disabled}
      onClick={onRemove}
    >
      <X size={16} aria-hidden="true" />
    </button>
  );
  return (
    <>
      {session ? (
        <>
          <div className="fitness-session-set-heading">
            {handle}
            {remove}
          </div>
          <details className="fitness-set-targets">
            <summary>Advanced · {targetSummary(set, unit)}</summary>
            <div className="fitness-set-fields">
              {(["reps", "load", "duration"] as const).map((field) =>
                measurement(field),
              )}
            </div>
            <div className="fitness-set-fields">
              {secondary.map((field) => measurement(field, true))}
            </div>
          </details>
          <div className="fitness-set-fields is-actual">
            {main.map((field) => measurement(field, true))}
          </div>
          <div className="fitness-set-completion">
            <label className="fitness-check">
              <input
                type="checkbox"
                disabled={
                  disabled ||
                  set.skipped ||
                  (set.reps === null && set.durationSeconds === null)
                }
                checked={set.completed}
                onChange={(event) => {
                  onChange({ ...set, completed: event.target.checked });
                  if (event.target.checked && hasNextSet && set.restSeconds)
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
                onChange={(event) =>
                  onChange({
                    ...set,
                    skipped: event.target.checked,
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
      ) : (
        <>
          <div className="fitness-planned-set-row fitness-numbered-set-row">
            {handle}
            {main.map((field) => measurement(field, false, true))}
            <button
              type="button"
              className="icon-button fitness-set-expand"
              aria-label={`More details for set ${index + 1}`}
              title="Advanced set details"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {remove}
          </div>
          <div id={detailsId} className="fitness-set-timing" hidden={!expanded}>
            {secondary.map((field) => measurement(field))}
          </div>
          {!expanded &&
            secondary.some((field) => set[keys[field]] !== null) && (
              <p className="fitness-set-timing-summary">
                Additional targets saved
              </p>
            )}
        </>
      )}
      {hasNextSet && (
        <RestBetweenSets
          index={index}
          value={set.restSeconds}
          disabled={disabled}
          error={restError}
          onChange={(value) => onChange({ ...set, restSeconds: value })}
        />
      )}
    </>
  );
}
function targetSummary(set: SetDraft, unit: "kg" | "lb") {
  const parts = [
    set.targetReps !== null ? `${set.targetReps} reps` : null,
    set.targetWeightKg !== null
      ? `${number(fromKilograms(set.targetWeightKg, unit))} ${unit}`
      : null,
    set.targetDurationSeconds !== null ? `${set.targetDurationSeconds}s` : null,
  ].filter(Boolean);
  return parts.length ? `Target: ${parts.join(" / ")}` : "No targets";
}
