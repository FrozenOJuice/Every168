"use client";
import { useFitnessNavigation } from "./fitness-navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type {
  Exercise,
  ExerciseInput,
  ExerciseLoggingType,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { ExerciseDetails } from "./exercise-details";
import { ExerciseEditor } from "./exercise-editor";
import { useRecoverExerciseEditor } from "./exercise-editor-recovery";
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
  const navigation = useFitnessNavigation();
  const backLabel =
    navigation.parent?.view === "summary"
      ? "Back to summary"
      : navigation.parent?.href.split("?")[0] === "/fitness/exercises" ||
          !navigation.parent
        ? "Back to Exercises"
        : "Back to workout";
  const cache = useQueryClient();
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [recoveredCopy, setRecoveredCopy] = useState<ExerciseInput | null>(
    null,
  );
  useRecoverExerciseEditor((attempt) => {
    if (!attempt.item) setRecoveredCopy(attempt.input);
    if (attempt.item && (attempt.item.id === id || catalogKey))
      setEditing(attempt.item);
  });
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
  const back = () => {
    if (navigation.parent) void navigation.back();
    else router.replace("/fitness/exercises", { scroll: false });
  };
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
  if (editing || recoveredCopy)
    return (
      <div className="fitness-exercise-detail-page">
        <ExerciseEditor
          key={editing?.id ?? "copy"}
          item={editing ?? undefined}
          initialValues={recoveredCopy ?? undefined}
          onCancel={() => {
            setEditing(null);
            setRecoveredCopy(null);
          }}
          onSaved={(saved) => {
            cache.setQueryData(["fitness", "exercise", saved.id], saved);
            void cache.invalidateQueries({
              queryKey: ["fitness", "exercises"],
            });
            void cache.invalidateQueries({ queryKey: ["fitness", "catalog"] });
            setEditing(null);
            setRecoveredCopy(null);
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
        <button className="fitness-back" onClick={back}>
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
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
      backLabel={backLabel}
      onClose={back}
      onEdit={setEditing}
      onDuplicated={(saved) => {
        cache.setQueryData(["fitness", "exercise", saved.id], saved);
        router.replace(`/fitness/exercises/${saved.id}`);
      }}
      initialMode={navigation.current?.mode ?? mode}
    />
  );
}
