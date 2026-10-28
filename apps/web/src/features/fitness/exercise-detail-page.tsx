"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { Exercise, ExerciseLoggingType } from "@168hours/contracts";
import { api } from "@/lib/api";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { ExerciseDetails } from "./exercise-details";
import { ExerciseEditor } from "./exercise-editor";
import { libraryExercises } from "./exercise-library-model";

export function ExerciseDetailPage({
  id,
  catalogKey,
  mode,
}: {
  id?: string;
  catalogKey?: string;
  mode?: ExerciseLoggingType;
}) {
  const router = useRouter();
  const cache = useQueryClient();
  const [editing, setEditing] = useState<Exercise | null>(null);
  const exercise = useQuery({
    queryKey: ["fitness", "exercise", id],
    queryFn: () => api.getExercise(id!),
    enabled: !!id,
  });
  const catalog = useQuery({
    queryKey: ["fitness", "catalog"],
    queryFn: api.getExerciseCatalog,
    enabled: !!catalogKey || !!exercise.data?.catalogKey,
  });
  const needsCatalog = !!catalogKey || !!exercise.data?.catalogKey;
  const pending =
    (!!id && exercise.isPending) || (needsCatalog && catalog.isPending);
  const error = (id && exercise.error) || (needsCatalog && catalog.error);
  const back = () => router.push("/fitness", { scroll: false });
  const item = catalogKey
    ? libraryExercises(catalog.data ?? [], []).find(
        (row) => row.key === catalogKey,
      )
    : exercise.data
      ? {
          key: exercise.data.id,
          name: exercise.data.name,
          notes: exercise.data.notes,
          equipment: exercise.data.equipment,
          muscles: exercise.data.muscles,
          exercise: exercise.data,
          definition: catalog.data?.find(
            (row) => row.key === exercise.data.catalogKey,
          ),
        }
      : undefined;
  if (editing)
    return (
      <div className="fitness-exercise-detail-page">
        <ExerciseEditor
          key={editing.id}
          item={editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            cache.setQueryData(["fitness", "exercise", saved.id], saved);
            void cache.invalidateQueries({
              queryKey: ["fitness", "exercises"],
            });
            void cache.invalidateQueries({ queryKey: ["fitness", "catalog"] });
            setEditing(null);
            router.replace(`/fitness/exercises/${saved.id}`);
          }}
        />
      </div>
    );
  if (pending || error || !item)
    return (
      <section
        className="fitness-exercise-detail-page"
        aria-label="Exercise details"
      >
        <button className="fitness-text-action" onClick={back}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Fitness
        </button>
        {pending ? (
          <Loading />
        ) : error ? (
          <ErrorState
            error={error}
            retry={() =>
              void (exercise.error ? exercise.refetch() : catalog.refetch())
            }
          />
        ) : (
          <p>Exercise not found.</p>
        )}
      </section>
    );
  return (
    <ExerciseDetails
      item={item}
      standalone
      backLabel="Back to Fitness"
      onClose={back}
      onEdit={setEditing}
      onDuplicated={setEditing}
      initialMode={mode}
    />
  );
}
