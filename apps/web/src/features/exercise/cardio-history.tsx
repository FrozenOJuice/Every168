"use client";
import { useCommand, CommandError } from "@/lib/use-command";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Cardio } from "@168hours/contracts";
import { localDate, fromMeters, toMeters } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Empty, Loading, ErrorState } from "@/components/ui/feedback";
import { formatDate, formatTime, number } from "@/lib/format";
import { exerciseDuration } from "./format";
import { invalidateExercise } from "./invalidate";
export function CardioHistory({ onEdit }: { onEdit: (c: Cardio) => void }) {
  const [search, setSearch] = useState("");
  const [activityType, setActivityType] = useState<Cardio["activityType"] | "">(
    "",
  );
  const {
    preferences: { timezone, distanceUnit },
  } = useMe();
  const query = useInfiniteQuery({
    queryKey: ["cardio", search, activityType],
    queryFn: ({ pageParam }) =>
      api.getCardio({
        cursor: pageParam,
        limit: 30,
        search,
        activityType: activityType || undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const cache = useQueryClient();
  const remove = useCommand({
    mutationFn: (item: { id: string; version: number }, key: string) =>
      api.deleteCardio(item.id, item.version, key),
    onSuccess: () => invalidateExercise(cache),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="panel">
      <h2>Cardio history</h2>
      <p className="muted text-small">
        Saved activities, newest logged first. Each activity records its actual
        time in Calendar.
      </p>
      <div className="exercise-history-filters">
        <div className="field">
          <label htmlFor="cardio-history-search">Search activities</label>
          <input
            id="cardio-history-search"
            type="search"
            maxLength={160}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="cardio-history-type">Filter activity type</label>
          <select
            id="cardio-history-type"
            value={activityType}
            onChange={(e) =>
              setActivityType(e.target.value as typeof activityType)
            }
          >
            <option value="">All activities</option>
            {["run", "walk", "swim", "cycle", "skip", "other"].map((type) => (
              <option key={type} value={type}>
                {type[0]!.toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !items.length ? (
        <Empty>
          {search || activityType
            ? "No activities match these filters."
            : "A walk, a run, a swim, or something else. Log the time; distance is optional."}
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
                    {formatDate(localDate(c.startedAt, timezone), {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {formatTime(c.startedAt, timezone)} ·{" "}
                    {exerciseDuration(c.durationSeconds)}
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
