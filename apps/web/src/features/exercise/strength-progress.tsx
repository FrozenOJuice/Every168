"use client";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fromKilograms, localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Empty, Loading, ErrorState } from "@/components/ui/feedback";
import { formatDate, number } from "@/lib/format";
export function StrengthProgress({ id }: { id: string }) {
  const {
    preferences: { weightUnit, timezone },
  } = useMe();
  const query = useInfiniteQuery({
    queryKey: ["progress", id],
    queryFn: ({ pageParam }) =>
      api.getStrengthProgress(id, { cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.history.nextCursor ?? undefined,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const max = query.data.pages[0]!.maxWeightKg;
  const sets = query.data.pages.flatMap((p) => p.history.items);
  return (
    <>
      <p>
        Max recorded load:{" "}
        <strong>
          {max === null
            ? "Not recorded"
            : number(fromKilograms(max, weightUnit)) + " " + weightUnit}
        </strong>
      </p>
      <p className="muted text-small">
        Completed sets from finished workouts. A record of your training,
        without a score.
      </p>
      {!sets.length ? (
        <Empty>No completed sets yet.</Empty>
      ) : (
        <ul className="record-list">
          {sets.map((s) => (
            <li key={s.id}>
              <div>
                <strong>
                  {s.reps !== null ? s.reps + " reps" : "Timed set"}
                  {s.weightKg !== null
                    ? " · " +
                      number(fromKilograms(s.weightKg, weightUnit)) +
                      " " +
                      weightUnit
                    : ""}
                  {s.durationSeconds !== null
                    ? " · " + s.durationSeconds + " sec"
                    : ""}
                </strong>
                <small>
                  {formatDate(localDate(s.startedAt, timezone))} ·{" "}
                  {s.exerciseNameSnapshot}
                </small>
              </div>
              <Link
                className="button"
                href={"/exercise/workout/" + s.workoutId}
              >
                View workout
              </Link>
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
          Load more sets
        </button>
      )}
    </>
  );
}
