"use client";
import { formatFitnessDuration } from "./rest-duration";
import { useId, useState, type ReactNode } from "react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { X, Plus, RotateCcw, Copy } from "lucide-react";
import { ContextMenu } from "@/components/ui/context-menu";
import type { SetCopyKind } from "./copy-following-sets";
import { fromKilograms, fromMeters } from "@168hours/domain-utils";
import {
  normalizeMeasurementOverride,
  plannedSetInput,
  type ExerciseLoggingType,
} from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { number } from "@/lib/format";
import type { SetDraft } from "./strength-draft";
import { WorkoutNumberField as NumberField } from "./workout-number-field";
import {
  exerciseTrackingFields,
  type ExerciseMeasurement,
} from "./exercise-tracking";
import { MeasurementFields } from "./measurement-fields";
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
  canRemove,
  handle,
  onChange,
  onRemove,
  onRest,
  onCopy,
  canCopyTargets = false,
  canCopyRest = false,
}: {
  set: SetDraft;
  index: number;
  loggingType?: ExerciseLoggingType;
  hasNextSet?: boolean;
  errors?: Record<string, string>;
  errorPrefix?: string;
  session?: boolean;
  disabled: boolean;
  canRemove: boolean;
  handle: ReactNode;
  onChange: (set: SetDraft) => void;
  onRemove: () => void;
  onRest?: (seconds: number) => void;
  onCopy?: (kind: SetCopyKind) => void;
  canCopyTargets?: boolean;
  canCopyRest?: boolean;
}) {
  const { weightUnit: unit, distanceUnit, durationUnit } = useMe().preferences;
  const hiddenRestErrorId = useId();
  const invalidFinalRest =
    !hasNextSet &&
    !plannedSetInput.shape.restSeconds.safeParse(set.restSeconds).success;
  const [configuring, setConfiguring] = useState(false);
  const [copyAnchor, setCopyAnchor] = useState<HTMLButtonElement | null>(null);
  const configurationId = useId();
  const override = normalizeMeasurementOverride(
    set.measurementOverride,
    loggingType,
  );
  const main = exerciseTrackingFields[override ?? loggingType];
  const defaults = exerciseTrackingFields[loggingType];
  const defaultSlots = defaults.slice(
    0,
    defaults.findLastIndex((field) => main.includes(field)) + 1,
  );
  const extraFields = main.filter((field) => !defaults.includes(field));
  const secondary = (
    ["reps", "load", "duration", "distance", "laps"] as const
  ).filter((field) => !main.includes(field));
  const keys = {
    reps: "targetReps",
    load: "targetWeightKg",
    duration: "targetDurationSeconds",
    distance: "targetDistanceMeters",
    laps: "targetLaps",
  } as const;
  const actualKeys = {
    reps: "reps",
    load: "weightKg",
    duration: "durationSeconds",
    distance: "distanceMeters",
    laps: "laps",
  } as const;
  const labels = {
    reps: "reps",
    load: `load (${unit})`,
    duration: "duration (seconds)",
    distance: `distance (${distanceUnit})`,
    laps: "laps",
  };
  const messages = {
    reps: "Use whole reps from 1 to 10,000, or leave blank.",
    load: `Use a load from 0 to ${number(fromKilograms(2000, unit))} ${unit}, or leave blank.`,
    duration: "Enter 1 second to 24 hours, or leave blank.",
    distance: "Use a positive distance up to 10,000 km, or leave blank.",
    laps: "Use whole laps from 1 to 10,000, or leave blank.",
  };
  const restError = errors[`${errorPrefix}.restSeconds`]
    ? "Use whole seconds from 0 to 3,600, or leave blank."
    : undefined;
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
        displayLabel={
          !session
            ? field === "duration"
              ? "Time (sec)"
              : field === "distance"
                ? `Dist. (${distanceUnit})`
                : labels[field][0]!.toUpperCase() + labels[field].slice(1)
            : undefined
        }
        value={set[key]}
        weight={field === "load"}
        distance={field === "distance"}
        duration={field === "duration"}
        disabled={disabled}
        error={errors[`${errorPrefix}.${key}`] ? messages[field] : undefined}
        onChange={(value) =>
          onChange({
            ...set,
            [key]: value,
            ...(actual ? { resultsEdited: true } : {}),
          })
        }
      />
    );
  };
  const remove = (
    <TooltipButton
      type="button"
      className="icon-button fitness-remove-control"
      aria-label={`Remove set ${index + 1}`}
      tooltip={canRemove ? "Remove set" : "Keep at least one set"}
      aria-description={!canRemove ? "Keep at least one set" : undefined}
      disabled={disabled || !canRemove}
      onClick={onRemove}
    >
      <X size={16} aria-hidden="true" />
    </TooltipButton>
  );
  const copy = onCopy && (
    <TooltipButton
      type="button"
      className="icon-button"
      aria-label={`Apply set ${index + 1} to following sets`}
      tooltip={
        !hasNextSet
          ? "No following sets"
          : !canCopyTargets && !canCopyRest
            ? "Nothing to apply to following sets"
            : "Apply to following sets"
      }
      aria-haspopup="menu"
      aria-expanded={!!copyAnchor}
      disabled={disabled || !hasNextSet || (!canCopyTargets && !canCopyRest)}
      onClick={(event) => setCopyAnchor(event.currentTarget)}
    >
      <Copy size={15} aria-hidden="true" />
    </TooltipButton>
  );
  const addMeasurements = (
    <TooltipButton
      type="button"
      className="icon-button fitness-set-add-measurements"
      data-custom={!!override}
      tooltip={
        override
          ? "Custom measurements · Add or remove measurements"
          : "Add or remove measurements"
      }
      aria-label={`Measurements for set ${index + 1}`}
      aria-description={
        override
          ? "This set uses custom measurements"
          : "Uses exercise measurements"
      }
      aria-expanded={configuring}
      aria-controls={configurationId}
      disabled={disabled}
      onClick={() => setConfiguring(!configuring)}
    >
      <Plus size={17} aria-hidden="true" />
    </TooltipButton>
  );
  const configuration = (
    <div
      id={configurationId}
      className="fitness-set-configuration"
      hidden={!configuring}
    >
      <MeasurementFields
        hideLabel
        label={`Measurements for set ${index + 1}`}
        value={override ?? loggingType}
        disabled={disabled}
        description={null}
        onChange={(measurementOverride) =>
          onChange({
            ...set,
            measurementOverride: normalizeMeasurementOverride(
              measurementOverride,
              loggingType,
            ),
          })
        }
      />
      <TooltipButton
        type="button"
        className="icon-button fitness-set-reset-measurements"
        aria-label="Use exercise defaults"
        tooltip="Reset to exercise measurements"
        disabled={disabled || !override}
        onClick={() => onChange({ ...set, measurementOverride: null })}
      >
        <RotateCcw size={16} aria-hidden="true" />
      </TooltipButton>
    </div>
  );
  return (
    <>
      {copyAnchor && (
        <ContextMenu
          x={copyAnchor.getBoundingClientRect().left}
          y={copyAnchor.getBoundingClientRect().bottom + 4}
          anchor={copyAnchor}
          label={`Apply set ${index + 1} to following sets`}
          onClose={() => setCopyAnchor(null)}
          actions={[
            {
              label: "Apply filled targets to following sets",
              disabled: disabled || !canCopyTargets,
              run: () => onCopy?.("targets"),
            },
            {
              label: "Apply rest to following sets",
              disabled: disabled || !canCopyRest,
              run: () => onCopy?.("rest"),
            },
          ]}
        />
      )}
      {session ? (
        <>
          <div className="fitness-session-set-heading">
            {handle}
            <div className="fitness-set-actions">
              {addMeasurements}
              {copy}
              {remove}
            </div>
          </div>
          <details className="fitness-set-targets">
            <summary>
              Targets ·{" "}
              {targetSummary(set, unit, distanceUnit, main, durationUnit)}
            </summary>
            <div className="fitness-set-fields">
              {main.map((field) => measurement(field))}
            </div>
          </details>
          <div className="fitness-set-fields is-actual">
            {main.map((field) => measurement(field, true))}
          </div>
          {configuration}
          <div className="fitness-set-completion">
            <label className="fitness-check">
              <input
                type="checkbox"
                disabled={
                  disabled ||
                  set.skipped ||
                  (set.reps === null &&
                    set.weightKg === null &&
                    set.durationSeconds === null &&
                    set.distanceMeters === null &&
                    set.laps === null)
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
          <div className="fitness-set-editor-row">
            <div className="fitness-set-number-cell">{handle}</div>
            <div className="fitness-set-measurements">
              {defaultSlots.map((field) => (
                <div
                  key={field}
                  className="fitness-set-measurement-slot"
                  data-measurement={field}
                  aria-hidden={!main.includes(field) || undefined}
                >
                  {main.includes(field) && measurement(field)}
                </div>
              ))}
              {extraFields.length > 0 && (
                <div
                  className="fitness-set-extra-measurements"
                  style={{
                    gridTemplateColumns: extraFields
                      .map(
                        (field) =>
                          `minmax(0, ${field === "duration" ? 2 : 1}fr)`,
                      )
                      .join(" "),
                  }}
                >
                  {extraFields.map((field) => (
                    <div
                      key={field}
                      className="fitness-set-measurement-slot"
                      data-measurement={field}
                    >
                      {measurement(field)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="fitness-set-actions">
              {addMeasurements}
              {copy}
              {remove}
            </div>
            {configuration}
          </div>
        </>
      )}
      {secondary.some(
        (field) =>
          errors[`${errorPrefix}.${keys[field]}`] ||
          errors[`${errorPrefix}.${actualKeys[field]}`],
      ) && (
        <p
          className="error"
          role="alert"
          tabIndex={-1}
          data-validation-error="true"
        >
          A saved value for an unselected measurement is invalid. Select that
          measurement above to correct it.
        </p>
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
      {invalidFinalRest && (
        <div>
          <p id={hiddenRestErrorId} className="error" role="alert">
            The last set has an invalid rest value. Clear it to save, or add a
            following set to edit it.
          </p>
          <button
            type="button"
            className="fitness-text-action"
            disabled={disabled}
            data-validation-error="true"
            aria-describedby={hiddenRestErrorId}
            onClick={() => onChange({ ...set, restSeconds: null })}
          >
            Clear invalid rest
          </button>
        </div>
      )}
    </>
  );
}
function targetSummary(
  set: SetDraft,
  unit: "kg" | "lb",
  distanceUnit: "m" | "km" | "yd" | "mi",
  fields: ExerciseMeasurement[],
  durationUnit: import("@168hours/domain-utils").DurationUnit,
) {
  const parts = [
    fields.includes("reps") && set.targetReps !== null
      ? `${set.targetReps} reps`
      : null,
    fields.includes("load") && set.targetWeightKg !== null
      ? `${number(fromKilograms(set.targetWeightKg, unit))} ${unit}`
      : null,
    fields.includes("duration") && set.targetDurationSeconds !== null
      ? formatFitnessDuration(set.targetDurationSeconds, durationUnit)
      : null,
    fields.includes("distance") && set.targetDistanceMeters !== null
      ? `${number(fromMeters(set.targetDistanceMeters, distanceUnit))} ${distanceUnit}`
      : null,
    fields.includes("laps") && set.targetLaps !== null
      ? `${set.targetLaps} laps`
      : null,
  ].filter(Boolean);
  return parts.length ? `Target: ${parts.join(" / ")}` : "No targets";
}
