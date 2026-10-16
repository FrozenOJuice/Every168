"use client";
import { Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import type { LibraryExercise } from "./exercise-library-model";
export function ExerciseFavourite({
  item,
  compact = false,
  iconOnly = compact,
}: {
  item: LibraryExercise;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const cache = useQueryClient();
  const favourite = !!item.exercise?.favourite;
  const save = useCommand({
    mutationFn: async (
      { importKey, value }: { importKey: string; value: boolean },
      key: string,
    ) => {
      const exercise =
        item.exercise ??
        (await api.useCatalogExercise(item.definition!.key, importKey));
      return api.favouriteExercise(exercise.id, value, exercise.version, key);
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["fitness", "catalog"] });
      void cache.invalidateQueries({ queryKey: ["fitness", "exercises"] });
    },
  });
  return (
    <div
      className={
        compact
          ? "fitness-card-favourite"
          : iconOnly
            ? "fitness-detail-favourite"
            : undefined
      }
      data-favourite={favourite}
    >
      <button
        type="button"
        aria-label={
          iconOnly
            ? `${favourite ? "Unfavourite" : "Favourite"} ${item.name}`
            : undefined
        }
        title={
          iconOnly
            ? favourite
              ? "Remove from favourites"
              : "Add to favourites"
            : undefined
        }
        className={iconOnly ? "icon-button" : "fitness-text-action"}
        aria-pressed={favourite}
        aria-disabled={save.isPending}
        onClick={() =>
          !save.isPending &&
          save.mutate({ importKey: crypto.randomUUID(), value: !favourite })
        }
      >
        <Star
          size={18}
          fill={favourite ? "currentColor" : "none"}
          aria-hidden="true"
        />
        {!iconOnly && (favourite ? "Favourited" : "Favourite")}
      </button>
      <CommandError command={save} />
    </div>
  );
}
