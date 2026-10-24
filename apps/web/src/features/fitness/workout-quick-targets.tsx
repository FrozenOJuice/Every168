"use client";
import { normalizeMeasurementOverride } from "@168hours/contracts";
import { useState, useId } from "react";
import { ChevronDown, Timer } from "lucide-react";
import { useMe } from "@/features/identity/me";
import { RestDurationField } from "./rest-duration-field";
import { formatRestDuration } from "./rest-duration";
import { WorkoutNumberField } from "./workout-number-field";
import { exerciseTrackingFields } from "./exercise-tracking";
import {
  nextPlannedSet,
  type ExerciseDraft,
  type SetDraft,
} from "./strength-draft";

export function WorkoutQuickTargets({
  exercise,
  disabled,
  onChange,
}: {
  exercise: ExerciseDraft;
  disabled: boolean;
  onChange: (exercise: ExerciseDraft) => void;
}) {
  const { weightUnit, distanceUnit } = useMe().preferences;
  const [restOpen, setRestOpen] = useState(false);
  const restId = useId();
  const restAvailable = exercise.sets.length > 1;
  const restExpanded = restAvailable && restOpen;
  const restValues = exercise.sets
    .slice(0, -1)
    .map((set) => set.restSeconds ?? null);
  const sharedRest = restValues[0] ?? null;
  const restSummary = !restAvailable
    ? null
    : restValues.every((value) => value === sharedRest)
      ? sharedRest === null
        ? "Rest as needed"
        : sharedRest === 0
          ? "No rest"
          : formatRestDuration(sharedRest)
      : "Varies";
  const [countText, setCountText] = useState<string | null>(null);
  const changeCount = (count: number) => {
    if (count < 2) setRestOpen(false);
    const sets = exercise.sets.slice(0, count);
    while (sets.length < count) sets.push(nextPlannedSet(sets.at(-1)));
    onChange({ ...exercise, sets });
  };
  const activeFields = (set: SetDraft) =>
    exerciseTrackingFields[
      set.measurementOverride ?? exercise.loggingType ?? "reps_load"
    ];
  const fields = [...new Set(exercise.sets.flatMap(activeFields))];
  const keys = {
    reps: "targetReps",
    load: "targetWeightKg",
    duration: "targetDurationSeconds",
    distance: "targetDistanceMeters",
    laps: "targetLaps",
  } as const;
  const labels = {
    reps: "Target reps",
    load: `Target load (${weightUnit})`,
    duration: "Target duration (seconds)",
    distance: `Target distance (${distanceUnit})`,
    laps: "Target laps",
  };
  const common = (key: keyof SetDraft, sets = exercise.sets) =>
    sets.every((set) => set[key] === sets[0]?.[key])
      ? ((sets[0]?.[key] as number | null | undefined) ?? null)
      : null;
  const varied = fields.some((field) =>
    exercise.sets.some(
      (set) => set[keys[field]] !== exercise.sets[0]?.[keys[field]],
    ),
  );
  const update = (field: (typeof fields)[number], value: number | null) =>
    onChange({
      ...exercise,
      sets: exercise.sets.map((set) =>
        activeFields(set).includes(field)
          ? { ...set, [keys[field]]: value }
          : set,
      ),
    });
  return (
    <div className="fitness-quick-targets">
      {exercise.sets.some((set) =>
        normalizeMeasurementOverride(
          set.measurementOverride,
          exercise.loggingType ?? "reps_load",
        ),
      ) && (
        <p className="muted text-small">
          Some sets use custom measurements. Shared targets apply only to sets
          using that measurement.
        </p>
      )}
      <div className="fitness-quick-target-fields">
        <label className="field">
          Sets
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={countText ?? exercise.sets.length}
            disabled={disabled}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const text = event.target.value;
              setCountText(text);
              const count = Number(text);
              if (text && Number.isInteger(count) && count >= 1 && count <= 100)
                changeCount(count);
            }}
            onBlur={() => {
              if (countText === "") changeCount(1);
              setCountText(null);
            }}
          />
        </label>
        {fields.map((field) => (
          <WorkoutNumberField
            key={field}
            label={labels[field]}
            value={common(
              keys[field],
              exercise.sets.filter((set) => activeFields(set).includes(field)),
            )}
            placeholder={
              varied &&
              exercise.sets.some(
                (set) => set[keys[field]] !== exercise.sets[0]?.[keys[field]],
              )
                ? "Varies"
                : "Optional"
            }
            weight={field === "load"}
            distance={field === "distance"}
            disabled={disabled || !exercise.sets.length}
            onChange={(value) => update(field, value)}
          />
        ))}
      </div>
      {varied && (
        <p className="muted text-small">
          Targets vary by set. Changing a field here applies it to every set.
        </p>
      )}
      <div
        className="fitness-inline-editor fitness-rest-disclosure"
        data-open={restExpanded}
      >
        <button
          type="button"
          className="fitness-inline-editor-heading"
          disabled={disabled || !restAvailable}
          aria-label="Rest between sets"
          aria-describedby={
            !restAvailable
              ? `${restId}-hint`
              : restSummary
                ? `${restId}-value`
                : undefined
          }
          aria-expanded={restExpanded}
          aria-controls={restId}
          onClick={() => setRestOpen(!restOpen)}
        >
          <Timer size={16} aria-hidden="true" />
          <span className="fitness-rest-heading-copy">
            Rest between sets
            {!restAvailable && (
              <small id={`${restId}-hint`}>Requires at least 2 sets</small>
            )}
          </span>
          {restSummary && (
            <span id={`${restId}-value`} className="fitness-rest-summary">
              {restSummary}
            </span>
          )}
          <ChevronDown
            className="fitness-disclosure-chevron"
            size={16}
            aria-hidden="true"
          />
        </button>
        <div id={restId} hidden={!restExpanded} className="fitness-rest-editor">
          <RestDurationField
            value={common("restSeconds", exercise.sets.slice(0, -1))}
            disabled={disabled || !restAvailable}
            onChange={(value) =>
              onChange({
                ...exercise,
                sets: exercise.sets.map((set, index) =>
                  index < exercise.sets.length - 1
                    ? { ...set, restSeconds: value }
                    : set,
                ),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
