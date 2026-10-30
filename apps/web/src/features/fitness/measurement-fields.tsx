"use client";
import { Check, Plus } from "lucide-react";
import {
  exerciseMeasurementOptions,
  measurementsFor,
  measurementSetKey,
  type ExerciseLoggingType,
} from "@168hours/contracts";

export function MeasurementFields({
  label = "Measurements",
  ariaLabel,
  hideLabel = false,
  value,
  disabled = false,
  description = null,
  onChange,
}: {
  label?: string;
  ariaLabel?: string;
  hideLabel?: boolean;
  value: ExerciseLoggingType;
  disabled?: boolean;
  description?: string | null;
  onChange: (value: ExerciseLoggingType) => void;
}) {
  const selected = measurementsFor(value);
  return (
    <fieldset
      className="fitness-measurement-picker"
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <legend className={hideLabel ? "sr-only" : undefined}>{label}</legend>
      <div className="fitness-measurement-options">
        {exerciseMeasurementOptions.map((field) => {
          const checked = selected.includes(field);
          return (
            <label key={field} data-selected={checked}>
              <input
                type="checkbox"
                className="fitness-measurement-input"
                checked={checked}
                disabled={disabled || (checked && selected.length === 1)}
                onChange={() =>
                  onChange(
                    measurementSetKey(
                      checked
                        ? selected.filter((item) => item !== field)
                        : [...selected, field],
                    ),
                  )
                }
              />
              {checked ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Plus size={14} aria-hidden="true" />
              )}
              <span>
                {field === "load"
                  ? "Weight"
                  : field[0]!.toUpperCase() + field.slice(1)}
              </span>
            </label>
          );
        })}
      </div>
      {description && <p className="muted text-small">{description}</p>}
    </fieldset>
  );
}
