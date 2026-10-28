"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { strengthPlanInput, type StrengthPlanInput } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { Toast, useToast } from "@/components/ui/toast";
import type { LibraryExercise } from "./exercise-library-model";
import { emptySet, planExercises, planInput } from "./strength-draft";
import { WorkoutSearch, useWorkoutSearch } from "./workout-search";
import { invalidateFitness } from "./fitness-cache";
export function ExerciseAddToWorkout({ item }: { item: LibraryExercise }) {
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const { notice, show, dismiss } = useToast();
  const chooserId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const closeChooser = () => {
    setChoosing(false);
    trigger.current?.focus();
  };
  const router = useRouter();
  const cache = useQueryClient();
  const returnTo = item.definition
    ? `/fitness/exercises/catalog/${encodeURIComponent(item.definition.key)}`
    : `/fitness/exercises/${item.exercise!.id}`;
  // Retain the exact update/version if a response is lost and the same command is retried.
  const prepared = useRef(
    new Map<string, { input: StrengthPlanInput; version: number }>(),
  );
  const { search, setSearch, query: workouts } = useWorkoutSearch(choosing);
  const choices = workouts.data?.pages.flatMap((p) => p.items) ?? [];
  const add = useCommand({
    mutationFn: async (
      { id, importKey }: { id: string; importKey: string },
      key: string,
    ) => {
      const exercise = item.definition
        ? await api.useCatalogExercise(item.definition.key, importKey)
        : item.exercise!;
      if (!id)
        return {
          id: "new",
          exerciseId: exercise.id,
          title: "",
          occurrence: "",
        };
      let request = prepared.current.get(key);
      if (!request) {
        const workout = await api.getStrengthPlan(id);
        request = {
          version: workout.version,
          input: strengthPlanInput.parse({
            ...planInput(workout.title, workout.notes, [
              ...planExercises(workout),
              {
                exerciseId: exercise.id,
                name: exercise.name,
                loggingType: exercise.loggingType,
                intentTags: exercise.intentTags,
                notes: null,
                sets: [emptySet()],
              },
            ]),
            isDraft: workout.isDraft,
          }),
        };
        prepared.current.set(key, request);
      }
      const saved = await api.updateStrengthPlan(
        id,
        request.input,
        request.version,
        key,
      );
      return {
        id,
        exerciseId: exercise.id,
        title: saved.title,
        occurrence: `${saved.version}:${saved.exercises.length - 1}`,
      };
    },
    onSuccess: (result) => {
      prepared.current.clear();
      invalidateFitness(cache);
      closeChooser();
      const params = new URLSearchParams({ returnTo });
      if (result.id === "new") {
        params.set("exercise", result.exerciseId);
        router.push(`/fitness/workout/new?${params}`);
      } else {
        params.set("added", result.occurrence);
        show({
          kind: "success",
          message: `${item.name} added to ${result.title}.`,
          action: {
            label: "Edit workout",
            onClick: () =>
              router.push(`/fitness/workout/${result.id}?${params}`),
          },
        });
      }
    },
  });
  useUnsavedChanges(
    add.isPending,
    "Wait for the exercise addition to finish.",
    true,
  );
  const submit = (id: string) =>
    add.mutate({ id, importKey: crypto.randomUUID() });
  return (
    <div className="form-stack">
      <button
        ref={trigger}
        className="button primary fitness-exercise-add-trigger"
        aria-expanded={choosing}
        aria-controls={choosing ? chooserId : undefined}
        aria-disabled={add.isPending}
        onClick={() => {
          if (add.isPending) return;
          if (choosing) closeChooser();
          else {
            setSelected(null);
            setSearch("");
            dismiss();
            setChoosing(true);
          }
        }}
      >
        Add to workout
      </button>
      {notice && (
        <Toast
          key={notice.id}
          {...notice}
          durationMs={8000}
          onDismiss={() => dismiss()}
        />
      )}
      {choosing && (
        <section
          id={chooserId}
          aria-label="Choose a workout"
          className="fitness-workout-chooser"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !add.isPending) {
              event.preventDefault();
              event.stopPropagation();
              closeChooser();
            }
          }}
        >
          <div className="form-stack">
            <p>
              Add {item.name} with one blank set. Set its targets afterward.
            </p>
            <WorkoutSearch
              value={search}
              onChange={setSearch}
              disabled={add.isPending}
            />
            <div className="fitness-workout-results" key={search.trim()}>
              {workouts.isPending ? (
                <Loading />
              ) : workouts.error ? (
                <ErrorState
                  error={workouts.error}
                  retry={() => void workouts.refetch()}
                />
              ) : (
                <>
                  {choices.length ? (
                    <fieldset
                      className="fitness-workout-destinations"
                      disabled={add.isPending}
                    >
                      <legend>Choose an existing workout</legend>
                      {choices.map((workout) => (
                        <label
                          key={workout.id}
                          className="fitness-workout-destination"
                        >
                          <input
                            type="radio"
                            name="workout-destination"
                            value={workout.id}
                            checked={selected?.id === workout.id}
                            onChange={() =>
                              setSelected({
                                id: workout.id,
                                title: workout.title,
                              })
                            }
                          />
                          <span>
                            <strong>{workout.title}</strong>
                            <small>
                              {workout.exercises.length}{" "}
                              {workout.exercises.length === 1
                                ? "exercise"
                                : "exercises"}
                              {workout.isDraft ? " · Draft" : ""}
                            </small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p className="muted">
                      {search.trim()
                        ? "No workouts match your search."
                        : "No saved workouts yet."}
                    </p>
                  )}
                  {workouts.hasNextPage && (
                    <button
                      className="button"
                      disabled={workouts.isFetchingNextPage || add.isPending}
                      onClick={() => void workouts.fetchNextPage()}
                    >
                      Load more workouts
                    </button>
                  )}
                </>
              )}
            </div>
            <button
              className="button primary"
              disabled={!selected || add.isPending}
              onClick={() => selected && submit(selected.id)}
            >
              {add.isPending
                ? "Adding…"
                : selected
                  ? `Add to ${selected.title}`
                  : "Select a workout"}
            </button>
            <div className="fitness-workout-chooser-actions">
              <button
                className="button fitness-create-workout-choice"
                disabled={add.isPending}
                onClick={() => submit("")}
              >
                Create new workout
              </button>
              <button
                className="button"
                disabled={add.isPending}
                onClick={closeChooser}
              >
                Cancel
              </button>
            </div>
            <CommandError command={add} />
          </div>
        </section>
      )}
    </div>
  );
}
