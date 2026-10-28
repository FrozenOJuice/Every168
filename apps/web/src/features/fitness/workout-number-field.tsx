"use client";
import { useWorkoutDisplayUnits } from "./workout-display-units";
import { FitnessSelect } from "./fitness-select";
import { WorkoutDurationField } from "./workout-duration-field";
import { useId, useState } from "react";
import {
  fromKilograms,
  toKilograms,
  fromMeters,
  toMeters,
} from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { WorkoutNumericInput } from "./workout-numeric-input";
export function WorkoutNumberField({
  label,
  displayLabel,
  value,
  onChange,
  disabled,
  weight = false,
  distance = false,
  duration = false,
  min = 1,
  hideLabel = false,
  error,
  placeholder,
  steppers = false,
}: {
  label: string;
  displayLabel?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
  weight?: boolean;
  distance?: boolean;
  duration?: boolean;
  min?: number;
  hideLabel?: boolean;
  error?: string;
  placeholder?: string;
  steppers?: boolean;
}) {
  const id = useId();
  const { weightUnit, distanceUnit } = useMe().preferences;
  const preference = weight ? weightUnit : distanceUnit;
  const [selection, setSelection] = useState({ preference, unit: preference });
  if (selection.preference !== preference)
    setSelection({ preference, unit: preference });
  const displayUnits = useWorkoutDisplayUnits();
  const selectedUnit =
    (weight
      ? displayUnits?.units.weightUnit
      : displayUnits?.units.distanceUnit) ?? selection.unit;
  const unit = selectedUnit as typeof weightUnit;
  const selectedDistanceUnit = selectedUnit as typeof distanceUnit;
  const unitLabel = label.replace(/\s*\([^)]*\)$/, "");
  const inputLabel =
    weight || distance ? `${unitLabel} (${selectedUnit})` : label;
  if (duration)
    return (
      <WorkoutDurationField
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        error={error}
        hideLabel={hideLabel}
        placeholder={placeholder}
        steppers={steppers}
      />
    );
  const display =
    value === null
      ? ""
      : weight
        ? Number(fromKilograms(value, unit).toFixed(2))
        : distance
          ? Number(fromMeters(value, selectedDistanceUnit).toFixed(3))
          : value;
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {weight || distance
          ? (displayLabel ?? label).replace(/\s*\([^)]*\)$/, "")
          : (displayLabel ?? label)}
      </label>
      <WorkoutNumericInput
        controlLabel={inputLabel}
        steppers={steppers}
        unitControl={
          weight || distance ? (
            <FitnessSelect
              compact
              hideLabel
              searchable={false}
              label={`${unitLabel} unit`}
              value={selectedUnit}
              disabled={disabled}
              onChange={(unit) => {
                if (displayUnits)
                  displayUnits.change(
                    weight
                      ? { weightUnit: unit as typeof weightUnit }
                      : { distanceUnit: unit as typeof distanceUnit },
                  );
                else
                  setSelection({ preference, unit: unit as typeof preference });
              }}
              options={(weight ? ["kg", "lb"] : ["m", "km", "yd", "mi"]).map(
                (value) => ({ value, label: value }),
              )}
            />
          ) : undefined
        }
        id={id}
        aria-label={inputLabel}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        inputMode="decimal"
        step={weight || distance ? "any" : 1}
        min={weight || distance ? 0 : min}
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        onFocus={(event) => event.currentTarget.select()}
        onValueChange={(text) =>
          onChange(
            text === ""
              ? null
              : weight
                ? toKilograms(Number(text), unit)
                : distance
                  ? toMeters(Number(text), selectedDistanceUnit)
                  : Number(text),
          )
        }
      />
      {error && (
        <p
          id={`${id}-error`}
          className="error fitness-field-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
