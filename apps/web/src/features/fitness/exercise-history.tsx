"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fromKilograms, fromMeters } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { number } from "@/lib/format";
import { Loading, ErrorState, Empty } from "@/components/ui/feedback";
export function ExerciseHistory({ id }: { id: string }) {
  const { weightUnit: unit, distanceUnit, timezone } = useMe().preferences;
  const query = useInfiniteQuery({
    queryKey: ["fitness", "exercise-history", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getStrengthProgress(id, { cursor: pageParam }),
    getNextPageParam: (p) => p.history.nextCursor ?? undefined,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const entries = query.data.pages.flatMap((p) => p.history.items);
  return (
    <>
      <p className="muted text-small">
        Completed sets, most recently recorded first.
      </p>
      {entries.length === 0 ? (
        <Empty>No completed sets yet.</Empty>
      ) : (
        <ul className="record-list">
          {entries.map((s) => (
            <li key={s.id}>
              <a href={`/fitness/session/${s.workoutId}`}>
                {new Intl.DateTimeFormat("en", {
                  timeZone: timezone,
                  dateStyle: "medium",
                }).format(new Date(s.startedAt))}
              </a>
              <span>
                {s.reps !== null ? `${s.reps} reps` : ""}
                {s.weightKg !== null
                  ? ` · ${number(fromKilograms(s.weightKg, unit))} ${unit}`
                  : ""}
                {s.durationSeconds !== null ? ` · ${s.durationSeconds}s` : ""}
                {s.distanceMeters !== null
                  ? ` · ${number(fromMeters(s.distanceMeters, distanceUnit))} ${distanceUnit}`
                  : ""}
                {s.laps !== null ? ` · ${s.laps} laps` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <button className="button" onClick={() => void query.fetchNextPage()}>
          More sets
        </button>
      )}
    </>
  );
}
