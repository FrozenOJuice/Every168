"use client";
import { useId, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Food } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { number } from "@/lib/format";
export function FoodPicker({
  onChoose,
  kind,
  excludeId,
  includeMeals = false,
}: {
  onChoose: (f: Food) => void;
  kind?: Food["kind"];
  excludeId?: string;
  includeMeals?: boolean;
}) {
  const [search, setSearch] = useState("");
  const id = useId();
  const q = useInfiniteQuery({
    queryKey: ["food", "picker", search, kind],
    queryFn: ({ pageParam }) =>
      api.getFoods({ search, kind, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const choices =
    q.data?.pages
      .flatMap((p) => p.items)
      .filter(
        (f) => f.id !== excludeId && (includeMeals || f.kind !== "meal"),
      ) ?? [];
  return (
    <div className="form-stack">
      <label className="field" htmlFor={id}>
        {includeMeals
          ? "Find food, meals or recipes"
          : kind
            ? "Find a food"
            : "Find a food or recipe"}
        <input
          id={id}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <ul className="food-picker">
            {choices.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="button"
                  onClick={() => onChoose(f)}
                >
                  {f.name}
                  <small>
                    {number(f.servingAmount)} {f.servingUnit} · {f.kind}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {choices.length === 0 && (
            <p>
              {q.hasNextPage
                ? "No eligible ingredients on this page. Load more foods."
                : "No matching foods. Create a food in the library first."}
            </p>
          )}
        </>
      )}
      {q.hasNextPage && (
        <button
          type="button"
          className="button"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          More foods
        </button>
      )}
    </div>
  );
}
