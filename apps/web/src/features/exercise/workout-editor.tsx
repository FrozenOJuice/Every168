"use client";
import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { useFieldArray } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Workout,
  WorkoutUpdateInput,
  Exercise,
} from "@168hours/contracts";
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
import { WorkoutExercisePicker } from "./workout-exercise-picker";
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
  const [createdExercise, setCreatedExercise] = useState<Exercise>();
  const [newExercise, setNewExercise] = useState(false);
  const [saved, setSaved] = useState(false);
  const finish = useRef(false);
  const prepared = useRef<{ key: string; input: WorkoutUpdateInput } | null>(
    null,
  );
  const form = useZodForm(workoutFormSchema(timezone, weightUnit, workout), {
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
        id: s.id,
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
  const dirty = form.formState.isDirty;
  useUnsavedChanges(dirty);
  return (
    <>
      <Form
        form={form}
        onSubmit={async (v, key) => {
          const finishing = finish.current;
          const start =
            v.startedAt === instantToLocalInput(workout.startedAt, timezone)
              ? workout.startedAt
              : localInputToInstant(v.startedAt, timezone);
          const end =
            v.endedAt === null
              ? finishing
                ? new Date().toISOString()
                : null
              : workout.endedAt &&
                  v.endedAt === instantToLocalInput(workout.endedAt, timezone)
                ? workout.endedAt
                : localInputToInstant(v.endedAt, timezone);
          const input =
            prepared.current?.key === key
              ? prepared.current.input
              : workoutUpdateInput.parse({
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
                      id: s.id,
                      reps: s.reps,
                      weightKg:
                        s.weight === null
                          ? null
                          : toKilograms(s.weight, weightUnit),
                      durationSeconds: s.durationSeconds,
                      completed: s.completed,
                    })),
                  })),
                });
          if (
            prepared.current?.key !== key &&
            workout.endedAt &&
            !input.endedAt &&
            !confirm(
              "Reopen this workout and remove its completed time from Calendar until you finish it again?",
            )
          )
            return;
          // Capture generated finish time with the request key, including when the successful response is lost.
          prepared.current = { key, input };
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
              sets: v.exercises[index]!.sets.map((set, setIndex) => ({
                ...set,
                id: exercise.sets[setIndex]!.id,
              })),
            })),
          });
          setSaved(true);
          await invalidateExercise(cache);
        }}
      >
        <section className="panel form-stack">
          <div className="form-grid">
            <Field name="title" label="Workout title" />
            <Field
              name="startedAt"
              label="Started at"
              type="datetime-local"
              help={"In " + timezone}
            />
          </div>
          <Field
            name="endedAt"
            label="Finished at"
            type="datetime-local"
            optional
            help="Leave blank while training. For a past workout, enter its real finish time. Clearing this reopens a completed workout."
          />
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
        <WorkoutExercisePicker
          key={createdExercise?.id ?? "picker"}
          recent={createdExercise}
          full={array.fields.length >= 50}
          onNew={() => setNewExercise(true)}
          onAdd={(exercise) =>
            array.append({
              exerciseId: exercise.id,
              exerciseNameSnapshot: exercise.name,
              notes: null,
              sets: [
                {
                  reps: null,
                  weight: null,
                  durationSeconds: null,
                  completed: true,
                },
              ],
            })
          }
        />
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
          <ExerciseForm
            onSaved={(exercise) => {
              setCreatedExercise(exercise);
              setNewExercise(false);
            }}
          />
        </Dialog>
      )}
    </>
  );
}
