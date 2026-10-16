"use client";
import type { ReactNode } from "react";
import type { Exercise } from "@168hours/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import type { LibraryExercise } from "./exercise-library-model";
import { ExerciseVisual } from "./exercise-visual";
import { ExerciseFavourite } from "./exercise-favourite";

export function ExerciseLibraryCard({
  item,
  onChoose,
  onDetails,
  selected,
  children,
}: {
  item: LibraryExercise;
  onChoose?: (exercise: Exercise) => void;
  onDetails: (opener: HTMLButtonElement) => void;
  selected: boolean;
  children: ReactNode;
}) {
  const cache = useQueryClient();
  const add = useCommand({
    mutationFn: (_: void, key: string) =>
      item.definition
        ? api.useCatalogExercise(item.definition.key, key)
        : Promise.resolve(item.exercise!),
    onSuccess: (exercise) => {
      void cache.invalidateQueries({ queryKey: ["fitness", "catalog"] });
      onChoose?.(exercise);
    },
  });
  return (
    <div
      className={`fitness-library-tile${onChoose ? " accepts-additions" : ""}`}
    >
      <div className="fitness-card-frame">
        <button
          type="button"
          className="fitness-library-card"
          aria-label={item.name}
          aria-pressed={selected}
          onClick={(event) => onDetails(event.currentTarget)}
        >
          <span className="fitness-card-visual-wrap">
            <ExerciseVisual />
          </span>
          <span className="fitness-library-card-name">
            <span className="fitness-library-card-title" title={item.name}>
              {item.name}
            </span>
            {!item.definition && (
              <span className="fitness-custom-badge">Custom</span>
            )}
          </span>
          <span className="fitness-card-information">{children}</span>
        </button>
        {onChoose && (
          <button
            type="button"
            className="fitness-card-add"
            aria-label={`Add ${item.name}`}
            title="Add to workout"
            disabled={add.isPending || !!item.exercise?.archivedAt}
            onClick={() => add.mutate()}
          >
            <Plus size={20} aria-hidden="true" />
            <span>{add.isPending ? "Adding…" : "Add to workout"}</span>
          </button>
        )}
        <ExerciseFavourite item={item} compact />
      </div>
      <CommandError command={add} />
    </div>
  );
}
