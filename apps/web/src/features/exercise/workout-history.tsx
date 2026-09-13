"use client";
import { useCommand, CommandError } from "@/lib/use-command";
import Link from "next/link";
import { useState } from "react";
import type { WorkoutHistoryQuery } from "@168hours/contracts";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { localDate, durationSeconds } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Empty, ErrorState, Loading } from "@/components/ui/feedback";
import { formatDate, hours, formatTime } from "@/lib/format";
import { invalidateExercise } from "./invalidate";
export function WorkoutHistory() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WorkoutHistoryQuery["status"]>("all");
  const {
    preferences: { timezone },
  } = useMe();
  const query = useInfiniteQuery({
    queryKey: ["workouts", search, status],
    queryFn: ({ pageParam }) =>
      api.getWorkouts({ cursor: pageParam, limit: 30, search, status }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const cache = useQueryClient();
  const remove = useCommand({
    mutationFn: (item: { id: string; version: number }, key: string) =>
      api.deleteWorkout(item.id, item.version, key),
    onSuccess: () => invalidateExercise(cache),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="panel">
      <h2>Workout history</h2>
      <p className="muted text-small">
        Saved sessions, newest logged first. Resume a workout or open one to
        review and correct it.
      </p>
      <div className="exercise-history-filters">
        <div className="field">
          <label htmlFor="workout-history-search">Search workouts</label>
          <input
            id="workout-history-search"
            type="search"
            value={search}
            maxLength={160}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="workout-history-status">Workout status</label>
          <select
            id="workout-history-status"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as WorkoutHistoryQuery["status"])
            }
          >
            <option value="all">All workouts</option>
            <option value="active">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !items.length ? (
        <Empty>
          {search || status !== "all"
            ? "No workouts match these filters."
            : "Start a workout and add your exercises and sets. You can save it and return at any time."}
        </Empty>
      ) : (
        <ul className="record-list">
          {items.map((w) => (
            <li key={w.id}>
              <div>
                <span className="badge">
                  {w.endedAt ? "Completed" : "In progress"}
                </span>
                <h3 className="history-title">
                  <Link href={"/exercise/workout/" + w.id}>{w.title}</Link>
                </h3>
                <small>
                  {formatDate(localDate(w.startedAt, timezone), {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" · " + formatTime(w.startedAt, timezone)}
                  {w.endedAt
                    ? " · " + hours(durationSeconds(w.startedAt, w.endedAt))
                    : ""}
                </small>
                {w.linkedTimeBlockId && (
                  <small>Linked to a Calendar plan</small>
                )}
              </div>
              <div className="row">
                <Link className="button" href={"/exercise/workout/" + w.id}>
                  {w.endedAt ? "View workout" : "Continue workout"}
                </Link>
                <button
                  className="button danger"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this workout, all its sets, and its recorded weekly time?",
                      )
                    )
                      remove.mutate(w);
                  }}
                >
                  Delete
                </button>
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
          Load more workouts
        </button>
      )}
      <CommandError command={remove} />
    </section>
  );
}
