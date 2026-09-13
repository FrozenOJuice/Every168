"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Water, Weight, Page } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Empty, ErrorState, Loading } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import { MeasurementForm } from "./measurement-form";
import { MeasurementList } from "./measurement-list";

export function MeasurementHistory({
  kind,
  through,
}: {
  kind: "water" | "weight";
  through?: string;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const [editing, setEditing] = useState<Water | Weight | null>(null);
  const query = useInfiniteQuery({
    queryKey: [kind, "history", through, timezone],
    queryFn: async ({ pageParam }): Promise<Page<Water | Weight>> =>
      kind === "water"
        ? api.getWater({ cursor: pageParam, limit: 30, through })
        : api.getWeight({ cursor: pageParam, limit: 30, through }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (editing)
    return (
      <div className="stack">
        <button className="button" onClick={() => setEditing(null)}>
          Back to history
        </button>
        <MeasurementForm
          kind={kind}
          item={editing}
          onSaved={() => setEditing(null)}
        />
      </div>
    );
  return (
    <div className="stack">
      <p className="muted text-small">
        Recently added entries
        {through
          ? " through " +
            formatDate(through, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : ""}
        . Each entry shows when it was measured or consumed.
      </p>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.pages[0]?.items.length ? (
        <Empty>No {kind} entries in this history.</Empty>
      ) : (
        <MeasurementList
          kind={kind}
          entries={query.data.pages.flatMap((page) => page.items)}
          onEdit={setEditing}
          showDate
        />
      )}
      {query.hasNextPage && (
        <button
          className="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more records
        </button>
      )}
    </div>
  );
}
