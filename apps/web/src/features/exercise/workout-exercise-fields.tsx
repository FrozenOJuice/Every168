"use client";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Field } from "@/components/ui/form";
import { useMe } from "@/features/identity/me";
import type { WorkoutFormValues } from "./workout-form-schema";
export function WorkoutExerciseFields({
  index,
  onRemove,
  onUp,
  onDown,
}: {
  index: number;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const { control, watch, register, getValues } =
    useFormContext<WorkoutFormValues>();
  const sets = useFieldArray({
    control,
    name: `exercises.${index}.sets`,
    keyName: "formKey",
  });
  const {
    preferences: { weightUnit },
  } = useMe();
  const name = watch(`exercises.${index}.exerciseNameSnapshot`);
  return (
    <fieldset className="workout-exercise">
      <legend>
        {index + 1}. {name}
      </legend>
      <div className="row between">
        <div className="row">
          <button
            className="button"
            type="button"
            disabled={!onUp}
            onClick={onUp}
            aria-label={"Move " + name + " up"}
          >
            ↑
          </button>
          <button
            className="button"
            type="button"
            disabled={!onDown}
            onClick={onDown}
            aria-label={"Move " + name + " down"}
          >
            ↓
          </button>
        </div>
        <button
          className="button danger"
          type="button"
          onClick={() => {
            if (confirm("Remove this exercise and its sets from the workout?"))
              onRemove();
          }}
        >
          Remove exercise
        </button>
      </div>
      {sets.fields.map((set, i) => (
        <div className="set-row" key={set.formKey}>
          <strong className="set-number">Set {i + 1}</strong>
          <Field
            name={`exercises.${index}.sets.${i}.reps`}
            label="Reps"
            type="number"
            optional
            min={1}
            step={1}
          />
          <Field
            name={`exercises.${index}.sets.${i}.weight`}
            label={"Load (" + weightUnit + ")"}
            type="number"
            optional
            min={0}
            step="any"
          />
          <Field
            name={`exercises.${index}.sets.${i}.durationSeconds`}
            label="Time (seconds)"
            type="number"
            optional
            min={1}
            step={1}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              {...register(`exercises.${index}.sets.${i}.completed`)}
            />
            Done
          </label>
          <div className="row set-actions">
            <button
              className="icon-button"
              type="button"
              disabled={i === 0}
              aria-label={"Move set " + (i + 1) + " up"}
              onClick={() => sets.move(i, i - 1)}
            >
              ↑
            </button>
            <button
              className="icon-button"
              type="button"
              disabled={i === sets.fields.length - 1}
              aria-label={"Move set " + (i + 1) + " down"}
              onClick={() => sets.move(i, i + 1)}
            >
              ↓
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={"Remove set " + (i + 1)}
              onClick={() => {
                if (confirm("Remove this set?")) sets.remove(i);
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <button
        className="button"
        type="button"
        disabled={sets.fields.length >= 100}
        onClick={() =>
          sets.append({
            reps: null,
            weight: null,
            durationSeconds: null,
            completed: true,
          })
        }
      >
        Add set
      </button>
      {sets.fields.length > 0 && (
        <button
          className="button repeat-set"
          type="button"
          disabled={sets.fields.length >= 100}
          onClick={() => {
            const last = getValues(`exercises.${index}.sets`).at(-1)!;
            sets.append({
              reps: last.reps,
              weight: last.weight,
              durationSeconds: last.durationSeconds,
              completed: false,
            });
          }}
        >
          Repeat last set
        </button>
      )}
      <div className="exercise-notes">
        <Field
          name={`exercises.${index}.notes`}
          label="Exercise notes (optional)"
          optional
        />
      </div>
    </fieldset>
  );
}
