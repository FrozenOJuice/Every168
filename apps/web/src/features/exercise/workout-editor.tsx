"use client";
import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { useFieldArray } from "react-hook-form";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Workout } from "@168hours/contracts";
import { workoutUpdateInput } from "@168hours/contracts";
import {
  fromKilograms,
  toKilograms,
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Form, Field, useZodForm } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { BlockPicker } from "./block-picker";
import { ExerciseForm } from "./exercise-form";
import { WorkoutExerciseFields } from "./workout-exercise-fields";
import { workoutFormSchema } from "./workout-form-schema";
import { invalidateExercise } from "./invalidate";
export function WorkoutEditor({
  workout: initialWorkout,
}: {
  workout: Workout;
}) {
  const [workout, setWorkout] = useState(initialWorkout);
  const {
    preferences: { timezone, weightUnit },
  } = useMe();
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [newExercise, setNewExercise] = useState(false);
  const [saved, setSaved] = useState(false);
  const finish = useRef(false);
  const form = useZodForm(workoutFormSchema(timezone), {
    title: workout.title,
    startedAt: instantToLocalInput(workout.startedAt, timezone),
    endedAt: workout.endedAt
      ? instantToLocalInput(workout.endedAt, timezone)
      : null,
    notes: workout.notes,
    linkedTimeBlockId: workout.linkedTimeBlockId,
    exercises: workout.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      exerciseNameSnapshot: e.exerciseNameSnapshot,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        reps: s.reps,
        weight:
          s.weightKg === null ? null : fromKilograms(s.weightKg, weightUnit),
        durationSeconds: s.durationSeconds,
        completed: s.completed,
      })),
    })),
  });
  const array = useFieldArray({
    control: form.control,
    name: "exercises",
    keyName: "formKey",
  });
  const library = useInfiniteQuery({
    queryKey: ["exercises", "picker", search],
    queryFn: ({ pageParam }) =>
      api.getExercises({ search, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const options = library.data?.pages.flatMap((p) => p.items) ?? [];
  const dirty = form.formState.isDirty;
  useUnsavedChanges(dirty);
  return (
    <>
      <Form
        form={form}
        onSubmit={async (v, key) => {
          const finishing = finish.current;
          finish.current = false;
          const start =
            v.startedAt === instantToLocalInput(workout.startedAt, timezone)
              ? workout.startedAt
              : localInputToInstant(v.startedAt, timezone);
          const end = finishing
            ? new Date().toISOString()
            : v.endedAt === null
              ? null
              : workout.endedAt &&
                  v.endedAt === instantToLocalInput(workout.endedAt, timezone)
                ? workout.endedAt
                : localInputToInstant(v.endedAt, timezone);
          const input = workoutUpdateInput.parse({
            title: v.title,
            startedAt: start,
            endedAt: end,
            notes: v.notes,
            linkedTimeBlockId: v.linkedTimeBlockId,
            exercises: v.exercises.map((e) => ({
              id: e.id,
              exerciseId: e.exerciseId,
              notes: e.notes,
              sets: e.sets.map((s) => ({
                reps: s.reps,
                weightKg:
                  s.weight === null ? null : toKilograms(s.weight, weightUnit),
                durationSeconds: s.durationSeconds,
                completed: s.completed,
              })),
            })),
          });
          const result = await api.saveWorkout(
            workout.id,
            input,
            workout.version,
            key,
          );
          setWorkout(result);
          form.reset({
            ...v,
            endedAt: result.endedAt
              ? instantToLocalInput(result.endedAt, timezone)
              : null,
            exercises: result.exercises.map((exercise, index) => ({
              ...v.exercises[index]!,
              id: exercise.id,
              exerciseNameSnapshot: exercise.exerciseNameSnapshot,
            })),
          });
          setSaved(true);
          await invalidateExercise(cache);
        }}
      >
        <section className="panel">
          <div className="form-grid">
            <Field name="title" label="Workout title" />
            <Field name="startedAt" label="Started at" type="datetime-local" />
          </div>
          {workout.endedAt && (
            <Field name="endedAt" label="Finished at" type="datetime-local" />
          )}
          <BlockPicker existingId={workout.linkedTimeBlockId} />
          <Field
            name="notes"
            label="Workout notes (optional)"
            type="textarea"
            optional
          />
        </section>
        {array.fields.map((e, i) => (
          <WorkoutExerciseFields
            key={e.formKey}
            index={i}
            onRemove={() => array.remove(i)}
            onUp={i ? () => array.move(i, i - 1) : undefined}
            onDown={
              i < array.fields.length - 1
                ? () => array.move(i, i + 1)
                : undefined
            }
          />
        ))}
        <section className="panel">
          <h2>Add an exercise</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="exercise-search">Search exercises</label>
              <input
                id="exercise-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="exercise-picker">Saved exercise</label>
              <select
                id="exercise-picker"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choose an exercise</option>
                {options.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row exercise-picker-actions">
            <button
              className="button primary"
              type="button"
              disabled={!selected}
              onClick={() => {
                const definition = options.find((e) => e.id === selected);
                if (definition) {
                  array.append({
                    exerciseId: definition.id,
                    exerciseNameSnapshot: definition.name,
                    notes: null,
                    sets: [
                      {
                        reps: null,
                        weight: null,
                        durationSeconds: null,
                        completed: true,
                      },
                    ],
                  });
                  setSelected("");
                }
              }}
            >
              Add to workout
            </button>
            <button
              className="button"
              type="button"
              onClick={() => setNewExercise(true)}
            >
              New exercise
            </button>
            {library.hasNextPage && (
              <button
                className="button"
                type="button"
                disabled={library.isFetchingNextPage}
                onClick={() => void library.fetchNextPage()}
              >
                Load more exercises
              </button>
            )}
          </div>
          {library.error && (
            <p className="error" role="alert">
              {library.error.message}
            </p>
          )}
        </section>
        <div className="save-workout">
          <div>
            <strong>
              {workout.endedAt ? "Completed workout" : "Workout in progress"}
            </strong>
            <small>
              {dirty
                ? "Unsaved changes. Save before leaving."
                : saved
                  ? "Changes saved."
                  : "Your saved workout."}
            </small>
          </div>
          <div className="row">
            <button
              className="button"
              type="submit"
              disabled={form.formState.isSubmitting}
              onClick={() => {
                finish.current = false;
              }}
            >
              {form.formState.isSubmitting ? "Saving…" : "Save workout"}
            </button>
            {!workout.endedAt && (
              <button
                className="button primary"
                type="submit"
                disabled={form.formState.isSubmitting}
                onClick={() => {
                  finish.current = true;
                }}
              >
                Finish workout
              </button>
            )}
          </div>
        </div>
      </Form>
      {newExercise && (
        <Dialog title="New exercise" onClose={() => setNewExercise(false)}>
          <ExerciseForm onSaved={() => setNewExercise(false)} />
        </Dialog>
      )}
    </>
  );
}
