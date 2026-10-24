"use client";
import { useId, useState } from "react";
import { ChevronDown, Ruler } from "lucide-react";
import { measurementsFor, type ExerciseLoggingType } from "@168hours/contracts";
import { MeasurementFields } from "./measurement-fields";

export function WorkoutMeasurementsEditor({
  name,
  value,
  disabled,
  onChange,
}: {
  name: string;
  value: ExerciseLoggingType;
  disabled: boolean;
  onChange: (value: ExerciseLoggingType) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const selected = measurementsFor(value)
    .map((field) => field[0]!.toUpperCase() + field.slice(1))
    .join(" · ");
  return (
    <div
      className="fitness-inline-editor fitness-workout-measurements-editor"
      data-open={open}
    >
      <button
        type="button"
        className="fitness-inline-editor-heading"
        aria-label={`Configure measurements for ${name}`}
        aria-describedby={`${id}-summary`}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Ruler size={16} aria-hidden="true" />
        <span className="fitness-measurements-heading-copy">
          <span>Measurements</span>
          <span id={`${id}-summary`} className="fitness-measurements-summary">
            {selected}
          </span>
        </span>
        <ChevronDown
          className="fitness-disclosure-chevron"
          size={16}
          aria-hidden="true"
        />
      </button>
      <div
        id={id}
        hidden={!open}
        className="fitness-workout-measurements-options"
      >
        <MeasurementFields
          hideLabel
          label="Configure measurements"
          ariaLabel={`Configure measurements for ${name}`}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
