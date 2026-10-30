"use client";
import { useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Exercise, ExerciseLoggingType } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { ArrowLeft } from "lucide-react";
import { ExerciseDetails } from "./exercise-details";
export function ExerciseHelp({
  id,
  onClose,
  history = false,
  mode,
  backLabel = "Back to Exercises",
  compact = false,
  onChoose,
}: {
  id: string;
  onClose: () => void;
  history?: boolean;
  mode?: ExerciseLoggingType;
  backLabel?: string;
  compact?: boolean;
  onChoose?: (exercise: Exercise) => void;
}) {
  const query = useQuery({
    queryKey: ["fitness", "exercise", id],
    queryFn: () => api.getExercise(id),
  });
  const catalog = useQuery({
    queryKey: ["fitness", "catalog"],
    queryFn: api.getExerciseCatalog,
    enabled: !!query.data?.catalogKey,
  });
  const pending =
    query.isPending || (query.data?.catalogKey && catalog.isPending);
  const error = query.error ?? (query.data?.catalogKey ? catalog.error : null);
  const statePanel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (pending || error) statePanel.current?.focus({ preventScroll: true });
  }, [pending, error]);
  if (pending || error)
    return (
      <section
        ref={statePanel}
        tabIndex={-1}
        className="fitness-inspector"
        aria-label="Exercise details"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <button type="button" className="fitness-back" onClick={onClose}>
          <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
        </button>
        {pending ? (
          <Loading />
        ) : (
          <ErrorState
            error={error!}
            retry={() =>
              void (query.error ? query.refetch() : catalog.refetch())
            }
          />
        )}
      </section>
    );
  const exercise = query.data!;
  return (
    <ExerciseDetails
      key={id}
      item={{
        key: exercise.catalogKey ?? id,
        name: exercise.name,
        notes: exercise.notes,
        equipment: exercise.equipment,
        muscles: exercise.muscles,
        exercise,
        definition: catalog.data?.find(
          (entry) => entry.key === exercise.catalogKey,
        ),
      }}
      onClose={onClose}
      onChoose={onChoose}
      backLabel={backLabel}
      onDuplicated={() => {}}
      initialHistory={history}
      initialMode={mode}
      workoutContext
      standalone={!compact}
      reference={compact}
    />
  );
}
