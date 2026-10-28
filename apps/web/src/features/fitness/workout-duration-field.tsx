"use client";
import { useWorkoutDisplayUnits } from "./workout-display-units";
import { FitnessSelect } from "./fitness-select";
import {
  fromSeconds,
  toSeconds,
  type DurationUnit,
} from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { useId, useState } from "react";
import { WorkoutNumericInput } from "./workout-numeric-input";

type AmountUnit = Exclude<DurationUnit, "min_sec">;
const initialUnit = (
  preference: DurationUnit,
  value: number | null,
): AmountUnit =>
  preference !== "min_sec"
    ? preference
    : value !== null && value >= 3600
      ? "h"
      : value !== null && value >= 60
        ? "min"
        : "s";

export function WorkoutDurationField({
  label,
  value,
  onChange,
  disabled,
  error,
  hideLabel,
  placeholder,
  steppers = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled: boolean;
  error?: string;
  hideLabel?: boolean;
  placeholder?: string;
  steppers?: boolean;
}) {
  const id = useId();
  const preference = useMe().preferences.durationUnit;
  const [selection, setSelection] = useState(() => ({
    preference,
    unit: initialUnit(preference, value),
  }));
  if (selection.preference !== preference)
    setSelection({ preference, unit: initialUnit(preference, value) });
  const displayUnits = useWorkoutDisplayUnits();
  const unit =
    displayUnits?.units.durationUnit &&
    displayUnits.units.durationUnit !== "min_sec"
      ? displayUnits.units.durationUnit
      : selection.unit;
  const name = label.replace(" (seconds)", "");
  const unitName =
    unit === "s" ? "seconds" : unit === "min" ? "minutes" : "hours";
  return (
    <div
      className="field fitness-duration-target"
      role="group"
      aria-label={name}
    >
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {name.replace(/^Target |^Actual /, "").replace(/^d/, "D")}
      </label>
      <WorkoutNumericInput
        id={id}
        controlLabel={`${name} ${unitName}`}
        steppers={steppers}
        unitControl={
          <FitnessSelect
            compact
            hideLabel
            searchable={false}
            label={`${name} unit`}
            value={unit}
            disabled={disabled}
            onChange={(unit) => {
              if (displayUnits)
                displayUnits.change({ durationUnit: unit as AmountUnit });
              else setSelection({ preference, unit: unit as AmountUnit });
            }}
            options={[
              { value: "s", label: "sec" },
              { value: "min", label: "min" },
              { value: "h", label: "hr" },
            ]}
          />
        }
        aria-label={`${name} (${unitName})`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        value={
          value === null ? "" : Number(fromSeconds(value, unit).toFixed(9))
        }
        disabled={disabled}
        min={0}
        step="any"
        inputMode="decimal"
        placeholder={placeholder ?? "—"}
        onFocus={(event) => event.currentTarget.select()}
        onValueChange={(text) =>
          onChange(text === "" ? null : toSeconds(Number(text), unit))
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
