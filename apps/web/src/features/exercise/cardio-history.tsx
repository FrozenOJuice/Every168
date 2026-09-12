"use client";
import { useCommand, CommandError } from "@/lib/use-command";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Cardio } from "@168hours/contracts";
import { localDate, fromMeters, toMeters } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Empty, Loading, ErrorState } from "@/components/ui/feedback";
import { formatDate, hours, number } from "@/lib/format";
import { invalidateExercise } from "./invalidate";
export function CardioHistory({ onEdit }: { onEdit: (c: Cardio) => void }) {
  const {
    preferences: { timezone, distanceUnit },
  } = useMe();
  const query = useInfiniteQuery({
    queryKey: ["cardio"],
    queryFn: ({ pageParam }) => api.getCardio({ cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const cache = useQueryClient();
  const remove = useCommand({
    mutationFn: (item: { id: string; version: number }, key: string) =>
      api.deleteCardio(item.id, item.version, key),
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
      <h2>Cardio history</h2>
      {!items.length ? (
        <Empty>
          A walk, a run, a swim, or something else. Log the time; distance is
          optional.
        </Empty>
      ) : (
        <ul className="record-list">
          {items.map((c) => {
            const pace =
              c.paceSecondsPerKm === null
                ? null
                : Math.round(
                    (c.paceSecondsPerKm * toMeters(1, distanceUnit)) / 1000,
                  );
            return (
              <li key={c.id}>
                <div>
                  <span className="badge">{c.activityType}</span>
                  <h3 className="history-title">{c.title}</h3>
                  <small>
                    {formatDate(localDate(c.startedAt, timezone))} ·{" "}
                    {hours(c.durationSeconds)}
                    {c.distanceMeters !== null
                      ? " · " +
                        number(fromMeters(c.distanceMeters, distanceUnit), 2) +
                        " " +
                        distanceUnit
                      : ""}
                    {pace !== null
                      ? " · " +
                        Math.floor(pace / 60) +
                        ":" +
                        String(pace % 60).padStart(2, "0") +
                        " /" +
                        distanceUnit
                      : ""}
                  </small>
                  {c.notes && <p className="muted text-small">{c.notes}</p>}
                </div>
                <div className="row">
                  <button className="button" onClick={() => onEdit(c)}>
                    Edit
                  </button>
                  <button
                    className="button danger"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this cardio activity and its recorded weekly time?",
                        )
                      )
                        remove.mutate(c);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {query.hasNextPage && (
        <button
          className="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more activities
        </button>
      )}
      <CommandError command={remove} />
    </section>
  );
}
