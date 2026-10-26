"use client";
import { WorkoutDurationField } from "./workout-duration-field";
import { useId } from "react";
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
  const { weightUnit: unit, distanceUnit } = useMe().preferences;
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
      />
    );
  const display =
    value === null
      ? ""
      : weight
        ? Number(fromKilograms(value, unit).toFixed(6))
        : distance
          ? Number(fromMeters(value, distanceUnit).toFixed(6))
          : value;
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {displayLabel ?? label}
      </label>
      <WorkoutNumericInput
        controlLabel={label}
        steppers={steppers}
        id={id}
        aria-label={displayLabel ? label : undefined}
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
                  ? toMeters(Number(text), distanceUnit)
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
