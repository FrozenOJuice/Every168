"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { strengthPlanInput } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { ErrorState } from "@/components/ui/feedback";
import type { LibraryExercise } from "./exercise-library-model";
import { emptySet, planExercises, planInput } from "./strength-draft";
import { FitnessSelect } from "./fitness-select";
import { invalidateFitness } from "./fitness-cache";
export function ExerciseAddToWorkout({ item }: { item: LibraryExercise }) {
  const [choosing, setChoosing] = useState(false);
  const [workoutId, setWorkoutId] = useState("");
  const router = useRouter();
  const cache = useQueryClient();
  const workouts = useInfiniteQuery({
    queryKey: ["fitness", "workout-choices"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getStrengthPlans({ kind: "workout", cursor: pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: choosing,
  });
  const add = useCommand({
    mutationFn: async (
      { id, importKey }: { id: string; importKey: string },
      key: string,
    ) => {
      const exercise = item.definition
        ? await api.useCatalogExercise(item.definition.key, importKey)
        : item.exercise!;
      if (!id) return { id: "new", exerciseId: exercise.id };
      const workout = await api.getStrengthPlan(id);
      const input = strengthPlanInput.parse({
        ...planInput(workout.title, workout.notes, [
          ...planExercises(workout),
          {
            exerciseId: exercise.id,
            name: exercise.name,
            notes: null,
            sets: [emptySet()],
          },
        ]),
        isDraft: workout.isDraft,
      });
      await api.updateStrengthPlan(id, input, workout.version, key);
      return { id, exerciseId: exercise.id };
    },
    onSuccess: (result) => {
      invalidateFitness(cache);
      router.push(
        result.id === "new"
          ? `/fitness/workout/new?exercise=${result.exerciseId}`
          : `/fitness/workout/${result.id}`,
      );
    },
  });
  // Materializing a built-in and updating a workout are separate idempotent commands.
  return (
    <div className="form-stack">
      {!choosing ? (
        <button className="button primary" onClick={() => setChoosing(true)}>
          Add to workout
        </button>
      ) : (
        <>
          <FitnessSelect
            label="Choose a workout"
            value={workoutId}
            onChange={setWorkoutId}
            disabled={add.isPending || workouts.isPending}
            options={[
              { value: "", label: "Create a new workout" },
              ...(workouts.data?.pages
                .flatMap((p) => p.items)
                .map((workout) => ({
                  value: workout.id,
                  label: `${workout.title}${workout.isDraft ? " (Draft)" : ""}`,
                })) ?? []),
            ]}
          />
          {workouts.error && (
            <ErrorState
              error={workouts.error}
              retry={() => void workouts.refetch()}
            />
          )}
          <button
            className="button primary"
            disabled={add.isPending || workouts.isPending || !!workouts.error}
            onClick={() =>
              add.mutate({ id: workoutId, importKey: crypto.randomUUID() })
            }
          >
            {workoutId ? "Add exercise" : "Build new workout"}
          </button>
          {workouts.hasNextPage && (
            <button
              className="fitness-text-action"
              disabled={workouts.isFetchingNextPage || add.isPending}
              onClick={() => void workouts.fetchNextPage()}
            >
              Load more workouts
            </button>
          )}
          <button
            className="fitness-text-action"
            disabled={add.isPending}
            onClick={() => setChoosing(false)}
          >
            Cancel
          </button>
        </>
      )}
      <CommandError command={add} />
    </div>
  );
}
