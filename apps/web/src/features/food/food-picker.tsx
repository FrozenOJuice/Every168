"use client";
import { RetainedReadError } from "@/components/ui/retained-read-error";
import { useId, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Food, FoodSelection } from "@168hours/contracts";
import { foodApi as api } from "./food-write-recovery";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { FoodCatalogue } from "./food-catalogue";
import { useFoodWritePending } from "./food-write-provider";
import { number } from "@/lib/format";
export function FoodPicker({
  onChoose,
  kind,
  excludeId,
  includeMeals = false,
}: {
  onChoose: (f: FoodSelection) => void;
  kind?: Food["kind"];
  excludeId?: string;
  includeMeals?: boolean;
}) {
  const pending = useFoodWritePending();
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
          maxLength={100}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {q.isPending ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <ul className="food-picker">
            {choices.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="button"
                  disabled={pending}
                  onClick={() => onChoose({ type: "owned", food: f })}
                >
                  {f.name}
                  <small>
                    {number(f.servingAmount)} {f.servingUnit} · {f.kind}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {choices.length === 0 && !q.error && (
            <p>
              {q.hasNextPage
                ? "No eligible ingredients on this page. Load more foods."
                : "No matching saved foods. Search the catalogue below or create a food."}
            </p>
          )}
        </>
      )}
      <RetainedReadError query={q} label="foods" />
      {q.hasNextPage && !q.error && (
        <button
          type="button"
          className="button"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          More foods
        </button>
      )}
      <FoodCatalogue
        search={search}
        onChoose={(food) => onChoose({ type: "catalogue", food })}
      />
    </div>
  );
}
