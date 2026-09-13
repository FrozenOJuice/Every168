"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Exercise } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Empty, ErrorState, Loading } from "@/components/ui/feedback";

export function WorkoutExercisePicker({
  onAdd,
  onNew,
  recent,
  full,
}: {
  onAdd: (exercise: Exercise) => void;
  onNew: () => void;
  recent?: Exercise;
  full: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(recent?.id ?? "");
  const library = useInfiniteQuery({
    queryKey: ["exercises", "picker", search],
    queryFn: ({ pageParam }) =>
      api.getExercises({ search, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const options = library.data?.pages.flatMap((p) => p.items) ?? [];
  if (recent && !options.some((e) => e.id === recent.id))
    options.unshift(recent);
  return (
    <section className="panel exercise-picker">
      <h2>Add an exercise</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="exercise-search">Search exercises</label>
          <input
            id="exercise-search"
            type="search"
            maxLength={160}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected("");
            }}
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
      {library.isPending ? (
        <Loading />
      ) : library.error ? (
        <ErrorState
          error={library.error}
          retry={() => void library.refetch()}
        />
      ) : !options.length ? (
        <Empty>
          {search
            ? "No matching exercises. Try another name or create one."
            : "Create your first exercise to start recording sets."}
        </Empty>
      ) : null}
      <div className="row exercise-picker-actions">
        <button
          className="button primary"
          type="button"
          disabled={full || !options.some((e) => e.id === selected)}
          onClick={() => {
            const exercise = options.find((e) => e.id === selected);
            if (exercise) {
              onAdd(exercise);
              setSelected("");
            }
          }}
        >
          Add to workout
        </button>
        <button className="button" type="button" onClick={onNew}>
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
      {full && (
        <p className="muted text-small">
          This workout has reached the limit of 50 exercises.
        </p>
      )}
    </section>
  );
}
