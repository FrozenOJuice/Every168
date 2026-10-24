"use client";
import { useId } from "react";
import {
  fromKilograms,
  toKilograms,
  fromMeters,
  toMeters,
} from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
export function WorkoutNumberField({
  label,
  displayLabel,
  value,
  onChange,
  disabled,
  weight = false,
  distance = false,
  min = 1,
  hideLabel = false,
  error,
  placeholder,
}: {
  label: string;
  displayLabel?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
  weight?: boolean;
  distance?: boolean;
  min?: number;
  hideLabel?: boolean;
  error?: string;
  placeholder?: string;
}) {
  const id = useId();
  const { weightUnit: unit, distanceUnit } = useMe().preferences;
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
      <input
        id={id}
        aria-label={displayLabel ? label : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        type="number"
        inputMode="decimal"
        step={weight || distance ? "any" : 1}
        min={weight || distance ? 0 : min}
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) =>
          onChange(
            event.target.value === ""
              ? null
              : weight
                ? toKilograms(Number(event.target.value), unit)
                : distance
                  ? toMeters(Number(event.target.value), distanceUnit)
                  : Number(event.target.value),
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
