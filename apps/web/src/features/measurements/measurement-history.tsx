"use client";
import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Water, Weight, Page } from "@168hours/contracts";
import { fromKilograms, localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Empty, ErrorState, Loading } from "@/components/ui/feedback";
import { MeasurementForm } from "./measurement-form";
import { WeightChart } from "./weight-chart";
import { formatDate, formatTime, number } from "@/lib/format";
export function MeasurementHistory({ kind }: { kind: "water" | "weight" }) {
  const {
    preferences: { timezone, weightUnit },
  } = useMe();
  const [editing, setEditing] = useState<Water | Weight | null>(null);
  const query = useInfiniteQuery({
    queryKey: [kind, "history"],
    queryFn: async ({ pageParam }): Promise<Page<Water | Weight>> =>
      kind === "water"
        ? api.getWater({ cursor: pageParam, limit: 30 })
        : api.getWeight({ cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const cache = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) =>
      kind === "water" ? api.deleteWater(id) : api.deleteWeight(id),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [kind] });
      await cache.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  if (editing)
    return (
      <>
        <button className="button" onClick={() => setEditing(null)}>
          Back to history
        </button>
        <MeasurementForm
          kind={kind}
          item={editing}
          onSaved={() => setEditing(null)}
        />
      </>
    );
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const items = query.data.pages.flatMap((p) => p.items);
  return (
    <>
      {kind === "weight" && items.length > 0 && (
        <WeightChart
          entries={items.filter((e): e is Weight => "weightKg" in e)}
        />
      )}
      {!items.length ? (
        <Empty>No {kind} entries yet.</Empty>
      ) : (
        <ul className="record-list">
          {items.map((e) => {
            const at = "measuredAt" in e ? e.measuredAt : e.consumedAt;
            return (
              <li key={e.id}>
                <div>
                  <strong>
                    {"weightKg" in e
                      ? number(fromKilograms(e.weightKg, weightUnit)) +
                        " " +
                        weightUnit
                      : e.amountMl + " ml"}
                  </strong>
                  <small>
                    {formatDate(localDate(at, timezone), {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {formatTime(at, timezone)}
                  </small>
                </div>
                <div className="row">
                  <button className="button" onClick={() => setEditing(e)}>
                    Edit
                  </button>
                  <button
                    className="button danger"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm("Delete this " + kind + " entry?"))
                        remove.mutate(e.id);
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
          Load more records
        </button>
      )}
      {remove.error && (
        <p role="alert" className="error">
          {remove.error.message}
        </p>
      )}
    </>
  );
}
