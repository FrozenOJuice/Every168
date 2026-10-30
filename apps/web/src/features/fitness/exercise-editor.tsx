"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import {
  exerciseInput,
  exerciseEquipmentOptions,
  exerciseMuscleOptions,
  type Exercise,
  type ExerciseInput,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { FitnessConfirm } from "./fitness-confirm";
import {
  exerciseEditorAttempt,
  useExerciseEditorRecoveryKey,
  type ExerciseEditorAttempt,
} from "./exercise-editor-recovery";
import { NotesField } from "./notes-field";

import { MeasurementFields } from "./measurement-fields";
import { ExerciseMultiSelect } from "./exercise-multi-select";

export function ExerciseEditor({
  item,
  initialValues,
  addToWorkout = false,
  onSaved,
  onCancel,
}: {
  item?: Exercise;
  initialValues?: ExerciseInput;
  addToWorkout?: boolean;
  onSaved: (item: Exercise) => void;
  onCancel: () => void;
}) {
  const initial = item ?? initialValues;
  const form = useRef<HTMLFormElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [loggingType, setLoggingType] = useState(
    initial?.loggingType ?? "reps_load",
  );
  const intentTags = initial?.intentTags ?? [];
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [equipment, setEquipment] = useState<Exercise["equipment"]>(
    initial?.equipment ?? [],
  );
  const [muscles, setMuscles] = useState<Exercise["muscles"]>(
    initial?.muscles ?? [],
  );
  const [favourite, setFavourite] = useState(initial?.favourite ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [discarding, setDiscarding] = useState(false);
  const value = {
    name,
    notes,
    equipment,
    muscles,
    favourite,
    loggingType,
    intentTags,
  };
  const dirty =
    JSON.stringify(value) !==
    JSON.stringify({
      name: initial?.name ?? "",
      notes: initial?.notes ?? "",
      equipment: initial?.equipment ?? [],
      muscles: initial?.muscles ?? [],
      favourite: initial?.favourite ?? false,
      loggingType: initial?.loggingType ?? "reps_load",
      intentTags: initial?.intentTags ?? [],
    });
  const recoveryKey = useExerciseEditorRecoveryKey();
  const save = useCommand({
    persistence: {
      key: recoveryKey,
      parse: (value) => exerciseEditorAttempt.parse(value),
    },
    mutationFn: (attempt: ExerciseEditorAttempt, key: string) =>
      attempt.item
        ? api.updateExercise(
            attempt.item.id,
            attempt.input,
            attempt.item.version,
            key,
          )
        : api.createExercise(attempt.input, key),
    onSuccess: onSaved,
  });
  useLayoutEffect(() => nameInput.current?.focus(), []);
  const [recoveredAttempt, setRecoveredAttempt] =
    useState<ExerciseEditorAttempt | null>(null);
  if (save.recoveredVariables && recoveredAttempt !== save.recoveredVariables) {
    setRecoveredAttempt(save.recoveredVariables);
    const recovered = save.recoveredVariables.input;
    setName(recovered.name);
    setNotes(recovered.notes ?? "");
    setLoggingType(recovered.loggingType ?? "reps_load");
    setEquipment(recovered.equipment ?? []);
    setMuscles(recovered.muscles ?? []);
    setFavourite(recovered.favourite ?? false);
  }
  useUnsavedChanges(
    dirty || save.isPending,
    "Leave this exercise without saving your changes?",
    save.isPending,
  );
  const cancel = () => {
    if (save.isPending) return;
    if (dirty) setDiscarding(true);
    else onCancel();
  };
  const action = item
    ? "Save changes"
    : addToWorkout
      ? "Create and add to workout"
      : "Create exercise";
  return (
    <>
      <form
        ref={form}
        className="fitness-exercise-editor"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (save.isPending) return;
          const parsed = exerciseInput.safeParse({
            ...value,
            notes: notes || null,
          });
          if (parsed.success) {
            setErrors({});
            save.mutate({ input: parsed.data, item });
            return;
          }
          const next: Record<string, string> = {};
          for (const issue of parsed.error.issues) {
            const field = String(issue.path[0]);
            next[field] ??=
              field === "name" && !name.trim()
                ? "Enter an exercise name."
                : issue.message;
          }
          setErrors(next);
          requestAnimationFrame(() =>
            form.current
              ?.querySelector<HTMLElement>('[aria-invalid="true"]')
              ?.focus(),
          );
        }}
      >
        <fieldset
          className="fitness-exercise-editor-frame"
          disabled={save.isPending}
        >
          <header className="fitness-exercise-detail-heading fitness-exercise-form-heading">
            <h2>{item ? "Edit exercise" : "Create exercise"}</h2>
            <button
              type="button"
              className="icon-button fitness-draft-favourite"
              aria-label="Favourite"
              aria-pressed={favourite}
              title={favourite ? "Remove from favourites" : "Add to favourites"}
              onClick={() => setFavourite(!favourite)}
            >
              <Star
                size={18}
                fill={favourite ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          </header>
          <div className="fitness-exercise-editor-fields form-stack">
            <label className="field">
              Exercise name
              <input
                id={nameId}
                ref={nameInput}
                required
                maxLength={160}
                value={name}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${nameId}-error` : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((current) => ({ ...current, name: "" }));
                }}
              />
            </label>
            {errors.name && (
              <p id={`${nameId}-error`} className="error" role="alert">
                {errors.name}
              </p>
            )}
            <MeasurementFields
              value={loggingType}
              description="Choose what you’ll track for each set. You can change this in a workout. Keep at least one measurement selected."
              disabled={save.isPending}
              onChange={setLoggingType}
            />
            <div className="fitness-exercise-metadata">
              <ExerciseMultiSelect
                label="Equipment"
                optional
                options={exerciseEquipmentOptions}
                value={equipment}
                onChange={setEquipment}
                error={errors.equipment}
                disabled={save.isPending}
              />
              <ExerciseMultiSelect
                label="Muscles worked"
                optional
                options={exerciseMuscleOptions}
                value={muscles}
                onChange={setMuscles}
                error={errors.muscles}
                disabled={save.isPending}
              />
            </div>
            <div className="fitness-exercise-editor-instructions">
              <NotesField
                label="Instructions (optional)"
                value={notes}
                onChange={(next) => setNotes(next ?? "")}
                error={errors.notes}
              />
            </div>
          </div>
          <footer className="fitness-exercise-editor-footer">
            <button
              data-exercise-cancel
              className="button"
              type="button"
              onClick={cancel}
            >
              Cancel
            </button>
            <button className="button primary" type="submit">
              {save.needsRetry
                ? "Awaiting confirmation…"
                : save.isPending
                  ? "Saving…"
                  : action}
            </button>
          </footer>
        </fieldset>
        <CommandError command={save} />
      </form>
      {discarding && (
        <FitnessConfirm
          title="Discard exercise changes?"
          description="Your changes haven’t been saved."
          action="Discard changes"
          danger
          onCancel={() => setDiscarding(false)}
          onConfirm={() => {
            setDiscarding(false);
            onCancel();
          }}
        />
      )}
    </>
  );
}
