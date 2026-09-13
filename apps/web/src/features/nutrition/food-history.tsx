"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { FoodEntry } from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Empty, ErrorState, Loading } from "@/components/ui/feedback";
import { FoodEntryRow } from "./food-entry-row";
import { formatDate } from "@/lib/format";

export function FoodHistory({
  date,
  onRepeat,
  onViewDay,
}: {
  date: string;
  onRepeat: (entry: FoodEntry) => void;
  onViewDay: (date: string) => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["nutrition", "history", search],
    queryFn: ({ pageParam }) =>
      api.getFoodHistory({ search, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const entries = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="stack">
      <p className="muted text-small">
        Recently added food entries from all dates. Log again opens a draft for{" "}
        {formatDate(date)} using the original nutrition.
      </p>
      <div className="field">
        <label htmlFor="food-history-search">Search food history</label>
        <input
          id="food-history-search"
          type="search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !entries.length ? (
        <Empty>
          {search
            ? "No entries match this search."
            : "No food entries yet. Your logged foods will be available here to repeat."}
        </Empty>
      ) : (
        <ul className="record-list">
          {entries.map((entry) => (
            <FoodEntryRow
              key={entry.id}
              entry={entry}
              timezone={timezone}
              showDate
            >
              <button
                className="button"
                onClick={() => onViewDay(localDate(entry.consumedAt, timezone))}
              >
                View day
              </button>
              <button className="button" onClick={() => onRepeat(entry)}>
                Log again
              </button>
            </FoodEntryRow>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <button
          className="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more entries
        </button>
      )}
    </div>
  );
}
