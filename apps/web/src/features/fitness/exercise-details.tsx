"use client";
import { useState, useLayoutEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star } from "lucide-react";
import {
  exerciseInput,
  exerciseEquipmentOptions,
  exerciseMuscleOptions,
  type Exercise,
  type ExerciseInput,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { NotesField } from "./notes-field";
import { ExerciseFavourite } from "./exercise-favourite";
import { ExerciseMultiSelect } from "./exercise-multi-select";
import { ExerciseVisual } from "./exercise-visual";
import { type LibraryExercise } from "./exercise-library-model";
import { ExerciseHistory } from "./exercise-history";
import { ExerciseAddToWorkout } from "./exercise-add-to-workout";
export function ExerciseDetails({
  item,
  onChoose,
  onClose,
  onDuplicated,
  onEdit,
  workoutContext = false,
  backLabel = "Back to exercises",
  hideBack = false,
}: {
  item: LibraryExercise;
  onChoose?: (exercise: Exercise) => void;
  onClose: () => void;
  onDuplicated: (exercise: Exercise) => void;
  onEdit?: (exercise: Exercise) => void;
  workoutContext?: boolean;
  backLabel?: string;
  hideBack?: boolean;
}) {
  const cache = useQueryClient();
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    panel.current?.focus({
      preventScroll: !window.matchMedia("(max-width: 1000px)").matches,
    });
  }, []);
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["fitness", "exercises"] });
    void cache.invalidateQueries({ queryKey: ["fitness", "catalog"] });
  };
  const choose = useCommand({
    mutationFn: (_: void, key: string) =>
      item.definition
        ? api.useCatalogExercise(item.definition.key, key)
        : Promise.resolve(item.exercise!),
    onSuccess: (exercise) => {
      refresh();
      onChoose?.(exercise);
    },
  });
  const edit = useCommand({
    mutationFn: (_: void, key: string) =>
      item.exercise
        ? Promise.resolve(item.exercise)
        : api.useCatalogExercise(item.definition!.key, key),
    onSuccess: (exercise) => {
      refresh();
      onEdit?.(exercise);
    },
  });
  const archive = useCommand({
    mutationFn: async ({ importKey }: { importKey: string }, key: string) => {
      const exercise =
        item.exercise ??
        (await api.useCatalogExercise(item.definition!.key, importKey));
      return item.definition
        ? api.hideExercise(exercise.id, !exercise.hidden, exercise.version, key)
        : exercise.archivedAt
          ? api.restoreExercise(exercise.id, exercise.version, key)
          : api.archiveExercise(exercise.id, exercise.version, key);
    },
    onSuccess: refresh,
  });
  const duplicate = useCommand({
    mutationFn: (_: void, key: string) =>
      api.duplicateExercise(
        item.definition
          ? { catalogKey: item.definition.key }
          : { exerciseId: item.exercise!.id, version: item.exercise!.version },
        key,
      ),
    onSuccess: (exercise) => {
      refresh();
      onDuplicated(exercise);
    },
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteExercise(item.exercise!.id, item.exercise!.version, key),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const busy =
    choose.isPending ||
    edit.isPending ||
    archive.isPending ||
    duplicate.isPending ||
    remove.isPending;
  return (
    <section
      className="fitness-inspector"
      aria-label={`${item.name} details`}
      tabIndex={-1}
      ref={panel}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {!hideBack && (
        <button
          className="fitness-text-action"
          onClick={onClose}
          disabled={busy}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </button>
      )}
      <>
        <div className="fitness-exercise-detail-heading">
          <div>
            <h2>{item.name}</h2>
            {!item.definition && (
              <span className="fitness-custom-badge">Custom</span>
            )}
          </div>
          <ExerciseFavourite item={item} iconOnly />
        </div>
        <ExerciseVisual large />
        <div className="fitness-exercise-equipment">
          <h3>Equipment</h3>
          <ul>
            {(item.equipment.length ? item.equipment : ["Not specified"]).map(
              (equipment) => (
                <li key={equipment}>{equipment}</li>
              ),
            )}
          </ul>
        </div>
        {item.muscles.length > 0 && (
          <div className="fitness-muscle-tags" aria-label="Muscles worked">
            {item.muscles.map((muscle) => (
              <span key={muscle}>{muscle}</span>
            ))}
          </div>
        )}
        <div className="fitness-exercise-instructions">
          <h3>How it works</h3>
          <p>{item.notes || "No instructions added yet."}</p>
        </div>
        {item.definition && item.exercise?.hidden && (
          <p className="text-small">
            Hidden from your library. Existing workouts and history are
            unchanged.
          </p>
        )}
        {item.exercise?.archivedAt && (
          <p className="text-small">
            Archived. Restore it to use it in a workout.
          </p>
        )}
        {onChoose ? (
          <button
            className="button primary"
            disabled={busy || !!item.exercise?.archivedAt}
            onClick={() => choose.mutate()}
          >
            Add {item.name}
          </button>
        ) : (
          !workoutContext &&
          !item.exercise?.archivedAt && <ExerciseAddToWorkout item={item} />
        )}
        {!workoutContext && (
          <div className="row">
            {!item.definition && (
              <button
                className="fitness-text-action"
                disabled={busy}
                onClick={() => edit.mutate()}
              >
                Edit exercise
              </button>
            )}
            <button
              className="fitness-text-action"
              disabled={busy}
              onClick={() => duplicate.mutate()}
            >
              Duplicate
            </button>
            <button
              className="fitness-text-action"
              disabled={busy}
              onClick={() => archive.mutate({ importKey: crypto.randomUUID() })}
            >
              {item.definition
                ? item.exercise?.hidden
                  ? "Show in library"
                  : "Hide"
                : item.exercise?.archivedAt
                  ? "Restore"
                  : "Archive"}
            </button>
            {!item.definition && item.exercise?.canDelete && (
              <button
                className="fitness-text-action"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm("Permanently delete this unused custom exercise?")
                  )
                    remove.mutate();
                }}
              >
                Delete exercise
              </button>
            )}
          </div>
        )}
        <CommandError command={choose} />
        <CommandError command={edit} />
        <CommandError command={archive} />
        <CommandError command={duplicate} />
        <CommandError command={remove} />
        {item.exercise && (
          <details className="fitness-secondary">
            <summary>Exercise history</summary>
            <ExerciseHistory id={item.exercise.id} />
          </details>
        )}
      </>
    </section>
  );
}
export function ExerciseEditor({
  item,
  onSaved,
  onCancel,
}: {
  item?: Exercise;
  onSaved: (item: Exercise) => void;
  onCancel: () => void;
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => nameInput.current?.focus(), []);
  const [name, setName] = useState(item?.name ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [equipment, setEquipment] = useState<Exercise["equipment"]>(
    item?.equipment ?? [],
  );
  const [muscles, setMuscles] = useState<Exercise["muscles"]>(
    item?.muscles ?? [],
  );
  const [favourite, setFavourite] = useState(item?.favourite ?? false);
  const [error, setError] = useState("");
  const save = useCommand({
    mutationFn: (v: ExerciseInput, key: string) =>
      item
        ? api.updateExercise(item.id, v, item.version, key)
        : api.createExercise(v, key),
    onSuccess: onSaved,
  });
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const parsed = exerciseInput.safeParse({
          name,
          notes: notes || null,
          equipment,
          muscles,
          favourite,
        });
        if (parsed.success) {
          setError("");
          save.mutate(parsed.data);
        } else setError(parsed.error.issues[0]!.message);
      }}
    >
      <fieldset className="form-stack" disabled={save.isPending}>
        <div className="fitness-exercise-detail-heading fitness-exercise-form-heading">
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
        </div>
        <label className="field">
          Exercise name
          <input
            ref={nameInput}
            required
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <ExerciseMultiSelect
          label="Equipment"
          options={exerciseEquipmentOptions}
          value={equipment}
          onChange={setEquipment}
        />
        <ExerciseMultiSelect
          label="Muscles worked"
          options={exerciseMuscleOptions}
          value={muscles}
          onChange={setMuscles}
        />
        <NotesField
          label="Instructions (optional)"
          value={notes}
          onChange={(notes) => setNotes(notes ?? "")}
        />
        <button className="button primary">Save exercise</button>
        <button
          className="fitness-text-action"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <CommandError command={save} />
    </form>
  );
}
