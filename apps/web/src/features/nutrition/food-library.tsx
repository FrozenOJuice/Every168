"use client";
import { useCommand, CommandError } from "@/lib/use-command";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Food } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Empty, ErrorState, Loading } from "@/components/ui/feedback";
export function FoodLibrary({
  onEdit,
  onLog,
}: {
  onEdit: (food: Food) => void;
  onLog: (food: Food) => void;
}) {
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["foods", "library", search, archived],
    queryFn: ({ pageParam }) =>
      api.getFoods({
        cursor: pageParam,
        search,
        archived: archived ? "true" : "false",
        limit: 30,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const cache = useQueryClient();
  const archive = useCommand({
    mutationFn: (item: Food, key: string) =>
      item.archivedAt
        ? api.restoreFood(item.id, item.version, key)
        : api.archiveFood(item.id, item.version, key),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["foods"] }),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="panel">
      <div className="row between">
        <h2>Your food library</h2>
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
        <label htmlFor="library-search">Search foods</label>
        <input
          id="library-search"
          type="search"
          maxLength={100}
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
            ? "No foods match this search."
            : archived
              ? "No archived foods."
              : "Add foods you eat regularly, using the values from their labels."}
        </Empty>
      ) : (
        <ul className="record-list">
          {items.map((f) => (
            <li key={f.id}>
              <div>
                <strong>{f.name}</strong>
                <small>
                  {f.servingAmount} {f.servingUnit} · {f.calories} kcal per
                  serving
                </small>
              </div>
              <div className="row">
                {!f.archivedAt && (
                  <button className="button" onClick={() => onLog(f)}>
                    Log
                  </button>
                )}
                {f.archivedAt && (
                  <button
                    className="button"
                    disabled={archive.isPending}
                    onClick={() => archive.mutate(f)}
                  >
                    Restore
                  </button>
                )}
                <button className="button" onClick={() => onEdit(f)}>
                  Edit
                </button>
                {!f.archivedAt && (
                  <button
                    className="button"
                    disabled={archive.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          "Archive this food? Your past food entries will stay unchanged.",
                        )
                      )
                        archive.mutate(f);
                    }}
                  >
                    Archive
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
          Load more foods
        </button>
      )}
      <CommandError command={archive} />
      {archive.isSuccess && (
        <p className="success" role="status">
          Food library updated.
        </p>
      )}
    </section>
  );
}
