"use client";
import { useCommand, CommandError } from "@/lib/use-command";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Exercise } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Empty, Loading, ErrorState } from "@/components/ui/feedback";
export function ExerciseLibrary({
  onEdit,
  onProgress,
}: {
  onEdit: (e: Exercise) => void;
  onProgress: (e: Exercise) => void;
}) {
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["exercises", "library", archived, search],
    queryFn: ({ pageParam }) =>
      api.getExercises({
        archived: archived ? "true" : "false",
        search,
        cursor: pageParam,
        limit: 30,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const cache = useQueryClient();
  const archive = useCommand({
    mutationFn: (item: Exercise, key: string) =>
      item.archivedAt
        ? api.restoreExercise(item.id, item.version, key)
        : api.archiveExercise(item.id, item.version, key),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["exercises"] });
      await cache.invalidateQueries({ queryKey: ["progress"] });
    },
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="panel">
      <div className="row between">
        <h2>Your exercises</h2>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>
      <div className="field">
        <label htmlFor="exercise-library-search">Search exercise library</label>
        <input
          id="exercise-library-search"
          type="search"
          maxLength={160}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !items.length ? (
        <Empty>
          {search
            ? "No matching exercises. Try another search."
            : archived
              ? "No archived exercises."
              : "Add exercises you use, such as Squat, Bench Press, or Plank."}
        </Empty>
      ) : (
        <ul className="record-list">
          {items.map((e) => (
            <li key={e.id}>
              <div>
                <strong>{e.name}</strong>
                {e.notes && <small>{e.notes}</small>}
              </div>
              <div className="row">
                <button className="button" onClick={() => onProgress(e)}>
                  Progress
                </button>
                <button className="button" onClick={() => onEdit(e)}>
                  Edit
                </button>
                {!e.archivedAt && (
                  <button
                    className="button"
                    disabled={archive.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          "Archive this exercise? Past workouts will remain intact.",
                        )
                      )
                        archive.mutate(e);
                    }}
                  >
                    Archive
                  </button>
                )}
                {e.archivedAt && (
                  <button
                    className="button"
                    disabled={archive.isPending}
                    onClick={() => archive.mutate(e)}
                  >
                    Restore
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <button
          className="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more exercises
        </button>
      )}
      <CommandError command={archive} />
    </section>
  );
}
