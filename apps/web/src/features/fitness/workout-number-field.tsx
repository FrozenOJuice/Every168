"use client";
import { useId } from "react";
import { fromKilograms, toKilograms } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
export function WorkoutNumberField({
  label,
  value,
  onChange,
  disabled,
  weight = false,
  min = 1,
  hideLabel = false,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
  weight?: boolean;
  min?: number;
  hideLabel?: boolean;
  error?: string;
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
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
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
