"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { fromKilograms, toKilograms } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { number } from "@/lib/format";
import type { SetDraft } from "./strength-draft";

export function WorkoutSetRow({
  set,
  index,
  session,
  disabled,
  handle,
  onChange,
  onRemove,
  onRest,
}: {
  set: SetDraft;
  index: number;
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
  const targetFields = (
    <>
      {session && (
        <>
          <NumberField
            label="Target reps"
            value={set.targetReps}
            disabled={disabled}
            onChange={(v) => onChange({ ...set, targetReps: v })}
          />
          <NumberField
            label={`Target load (${unit})`}
            value={set.targetWeightKg}
            weight
            disabled={disabled}
            onChange={(v) => onChange({ ...set, targetWeightKg: v })}
          />
        </>
      )}
      <NumberField
        label="Target duration (seconds)"
        value={set.targetDurationSeconds}
        disabled={disabled}
        onChange={(v) => onChange({ ...set, targetDurationSeconds: v })}
      />
      <NumberField
        label="Rest (seconds)"
        value={set.restSeconds}
        min={0}
        disabled={disabled}
        onChange={(v) => onChange({ ...set, restSeconds: v })}
      />
    </>
  );
  const remove = (
    <button
      type="button"
      className="icon-button fitness-remove-control"
      aria-label={`Remove set ${index + 1}`}
      title="Remove set"
      disabled={disabled}
      onClick={onRemove}
    >
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
  return (
    <>
      {session ? (
        <>
          <div className="fitness-session-set-heading">
            {handle}
            <strong>Set {index + 1}</strong>
            {remove}
          </div>
          <details className="fitness-set-targets">
            <summary>{targetSummary(set, unit)}</summary>
            <div className="fitness-set-fields">{targetFields}</div>
          </details>
          <div className="fitness-set-fields is-actual">
            <NumberField
              label="Actual reps"
              value={set.reps}
              disabled={disabled}
              onChange={(v) => onChange({ ...set, reps: v })}
            />
            <NumberField
              label={`Actual load (${unit})`}
              value={set.weightKg}
              weight
              disabled={disabled}
              onChange={(v) => onChange({ ...set, weightKg: v })}
            />
            <NumberField
              label="Actual duration (seconds)"
              value={set.durationSeconds}
              disabled={disabled}
              onChange={(v) => onChange({ ...set, durationSeconds: v })}
            />
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
                  if (event.target.checked && set.restSeconds)
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
          <div className="fitness-planned-set-row">
            {handle}
            <span className="fitness-set-number" aria-hidden="true">
              {index + 1}
            </span>
            <NumberField
              label="Target reps"
              hideLabel
              value={set.targetReps}
              disabled={disabled}
              onChange={(v) => onChange({ ...set, targetReps: v })}
            />
            <NumberField
              label={`Target load (${unit})`}
              hideLabel
              value={set.targetWeightKg}
              weight
              disabled={disabled}
              onChange={(v) => onChange({ ...set, targetWeightKg: v })}
            />
            <button
              type="button"
              className="icon-button fitness-set-expand"
              aria-label={`More details for set ${index + 1}`}
              title="Duration and rest"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {remove}
          </div>
          <div id={detailsId} className="fitness-set-timing" hidden={!expanded}>
            {targetFields}
          </div>
          {!expanded &&
            (set.targetDurationSeconds !== null ||
              set.restSeconds !== null) && (
              <p className="fitness-set-timing-summary">
                {[
                  set.targetDurationSeconds !== null
                    ? `${number(set.targetDurationSeconds)}s duration`
                    : null,
                  set.restSeconds !== null
                    ? `${number(set.restSeconds)}s rest`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
        </>
      )}
    </>
  );
}
function NumberField({
  label,
  value,
  onChange,
  disabled,
  weight = false,
  min = 1,
  hideLabel = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
  weight?: boolean;
  min?: number;
  hideLabel?: boolean;
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
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={weight ? "any" : 1}
        min={weight ? 0 : min}
        disabled={disabled}
        value={display}
        onChange={(event) =>
          onChange(
            event.target.value === ""
              ? null
              : weight
                ? toKilograms(Number(event.target.value), unit)
                : Number(event.target.value),
          )
        }
      />
    </div>
  );
}
function targetSummary(set: SetDraft, unit: "kg" | "lb") {
  const parts = [
    set.targetReps !== null ? `${set.targetReps} reps` : null,
    set.targetWeightKg !== null
      ? `${number(fromKilograms(set.targetWeightKg, unit))} ${unit}`
      : null,
    set.targetDurationSeconds !== null ? `${set.targetDurationSeconds}s` : null,
    set.restSeconds ? `${set.restSeconds}s rest` : null,
  ].filter(Boolean);
  return parts.length
    ? `Target: ${parts.join(" / ")}`
    : "Set a target (optional)";
}
