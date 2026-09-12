"use client";
import Link from "next/link";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { localDate, durationSeconds } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Empty, ErrorState, Loading } from "@/components/ui/feedback";
import { formatDate, hours } from "@/lib/format";
import { invalidateExercise } from "./invalidate";
export function WorkoutHistory() {
  const {
    preferences: { timezone },
  } = useMe();
  const query = useInfiniteQuery({
    queryKey: ["workouts"],
    queryFn: ({ pageParam }) =>
      api.getWorkouts({ cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const cache = useQueryClient();
  const remove = useMutation({
    mutationFn: api.deleteWorkout,
    onSuccess: () => invalidateExercise(cache),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const items = query.data.pages.flatMap((p) => p.items);
  return (
    <section className="panel">
      <h2>Workout history</h2>
      {!items.length ? (
        <Empty>
          Start a workout and add your exercises and sets. You can save it and
          return at any time.
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
                  {w.endedAt
                    ? " · " + hours(durationSeconds(w.startedAt, w.endedAt))
                    : ""}
                </small>
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
                      remove.mutate(w.id);
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
      {remove.error && (
        <p role="alert" className="error">
          {remove.error.message}
        </p>
      )}
    </section>
  );
}
