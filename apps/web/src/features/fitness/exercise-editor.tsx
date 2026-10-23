"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import {
  exerciseInput,
  exerciseEquipmentOptions,
  exerciseMuscleOptions,
  exerciseLoggingTypeSchema,
  type Exercise,
  type ExerciseInput,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Dialog } from "@/components/ui/dialog";
import { NotesField } from "./notes-field";
import { FitnessSelect } from "./fitness-select";
import { IntentTagsField } from "./intent-tags-field";
import { trackingLabels } from "./progress-shared";
import { ExerciseMultiSelect } from "./exercise-multi-select";

export function ExerciseEditor({
  item,
  addToWorkout = false,
  onSaved,
  onCancel,
}: {
  item?: Exercise;
  addToWorkout?: boolean;
  onSaved: (item: Exercise) => void;
  onCancel: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const [name, setName] = useState(item?.name ?? "");
  const [loggingType, setLoggingType] = useState(
    item?.loggingType ?? "reps_load",
  );
  const [intentTags, setIntentTags] = useState(item?.intentTags ?? []);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [equipment, setEquipment] = useState<Exercise["equipment"]>(
    item?.equipment ?? [],
  );
  const [muscles, setMuscles] = useState<Exercise["muscles"]>(
    item?.muscles ?? [],
  );
  const [favourite, setFavourite] = useState(item?.favourite ?? false);
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
      name: item?.name ?? "",
      notes: item?.notes ?? "",
      equipment: item?.equipment ?? [],
      muscles: item?.muscles ?? [],
      favourite: item?.favourite ?? false,
      loggingType: item?.loggingType ?? "reps_load",
      intentTags: item?.intentTags ?? [],
    });
  const save = useCommand({
    mutationFn: (v: ExerciseInput, key: string) =>
      item
        ? api.updateExercise(item.id, v, item.version, key)
        : api.createExercise(v, key),
    onSuccess: onSaved,
  });
  useLayoutEffect(() => nameInput.current?.focus(), []);
  useEffect(() => {
    if (!dirty && !save.isPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, save.isPending]);
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
            save.mutate(parsed.data);
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
            <FitnessSelect
              label="Tracking"
              value={loggingType}
              searchable={false}
              disabled={save.isPending}
              options={Object.entries(trackingLabels).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(value) =>
                setLoggingType(exerciseLoggingTypeSchema.parse(value))
              }
            />
            <IntentTagsField
              value={intentTags}
              onChange={setIntentTags}
              disabled={save.isPending}
            />
            <div className="fitness-exercise-metadata">
              <ExerciseMultiSelect
                label="Equipment"
                options={exerciseEquipmentOptions}
                value={equipment}
                onChange={setEquipment}
                error={errors.equipment}
                disabled={save.isPending}
              />
              <ExerciseMultiSelect
                label="Muscles worked"
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
            <button className="button" type="button" onClick={cancel}>
              Cancel
            </button>
            <button className="button primary" type="submit">
              {save.isPending ? "Saving…" : action}
            </button>
          </footer>
        </fieldset>
        <CommandError command={save} />
      </form>
      {discarding && (
        <Dialog
          title="Discard exercise changes?"
          onClose={() => setDiscarding(false)}
        >
          <p>Your changes haven’t been saved.</p>
          <div className="row">
            <button
              type="button"
              className="button primary"
              onClick={() => setDiscarding(false)}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setDiscarding(false);
                onCancel();
              }}
            >
              Discard changes
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
