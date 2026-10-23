"use client";
import { useState } from "react";
import { Archive, Star } from "lucide-react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Food } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { number } from "@/lib/format";
import { invalidateFood, nutrients } from "./food-shared";
export function FoodLibrary({
  kind,
  onCreate,
  onEdit,
  onLog,
}: {
  kind: Food["kind"];
  onCreate: () => void;
  onEdit: (f: Food) => void;
  onLog: (f: Food) => void;
}) {
  const [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false),
    [favourite, setFavourite] = useState(false);
  const cache = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["food", "library", kind, search, archived, favourite],
    queryFn: ({ pageParam }) =>
      api.getFoods({
        kind,
        search,
        archived: archived ? "true" : "false",
        favourite: favourite ? "true" : undefined,
        cursor: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const action = useCommand({
    mutationFn: (
      { food, operation }: { food: Food; operation: "archive" | "favourite" },
      key: string,
    ) =>
      operation === "favourite"
        ? api.favouriteFood(food.id, !food.favourite, food.version, key)
        : food.archivedAt
          ? api.restoreFood(food.id, food.version, key)
          : api.archiveFood(food.id, food.version, key),
    onSuccess: () => invalidateFood(cache),
  });
  return (
    <section className="form-stack">
      <div className="row between">
        <h2>
          {kind === "food"
            ? "Food library"
            : kind === "meal"
              ? "Saved meals"
              : "Recipes"}
        </h2>
        <button className="button primary" onClick={onCreate}>
          {kind === "food"
            ? "Create food"
            : kind === "meal"
              ? "Create meal"
              : "Create recipe"}
        </button>
      </div>
      <div className="food-library-filters">
        <label className="field">
          Search library
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className="button food-filter-button"
          aria-pressed={favourite}
          onClick={() => setFavourite(!favourite)}
        >
          <Star size={16} aria-hidden="true" />
          Favourites
        </button>
        <button
          className="button food-filter-button"
          aria-pressed={archived}
          onClick={() => setArchived(!archived)}
        >
          <Archive size={16} aria-hidden="true" />
          Archived
        </button>
      </div>
      <CommandError command={action} />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <div className="food-library-grid">
          {q.data.pages
            .flatMap((p) => p.items)
            .map((f) => (
              <article className="panel form-stack" key={f.id}>
                <div className="row between">
                  <h3>{f.name}</h3>
                  <button
                    className="button"
                    aria-label={`Favourite ${f.name}`}
                    aria-pressed={f.favourite}
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ food: f, operation: "favourite" })
                    }
                  >
                    {f.favourite ? "★" : "☆"}
                  </button>
                </div>
                <p className="muted">
                  {f.kind === "recipe"
                    ? `${f.yieldServings} portions per recipe · `
                    : ""}
                  {number(f.servingAmount)} {f.servingUnit} per serving
                </p>
                <p>
                  {f.calories === null
                    ? "Calories unknown"
                    : `${number(f.calories)} kcal per serving`}
                </p>
                <details>
                  <summary>Details and nutrition</summary>
                  <dl className="food-nutrients">
                    {nutrients.map(([key, label, unit]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>
                          {f[key] === null
                            ? "Unknown"
                            : `${number(f[key])} ${unit}`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {f.ingredients.length > 0 && (
                    <>
                      <p>
                        Ingredients for the{" "}
                        {f.kind === "recipe" ? "full recipe" : "whole meal"}:
                      </p>
                      <ul>
                        {f.ingredients.map((i, index) => (
                          <li key={index}>
                            {i.name} · {number(i.quantity)} × {i.servingAmount}{" "}
                            {i.servingUnit}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {f.instructions && (
                    <p className="food-instructions">{f.instructions}</p>
                  )}
                </details>
                <div className="row">
                  <button
                    className="button primary"
                    disabled={!!f.archivedAt}
                    onClick={() => onLog(f)}
                  >
                    Log {f.kind}
                  </button>
                  <button className="button" onClick={() => onEdit(f)}>
                    Edit
                  </button>
                  <button
                    className="button"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ food: f, operation: "archive" })
                    }
                  >
                    {f.archivedAt ? "Restore" : "Archive"}
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
      {q.data?.pages.every((p) => !p.items.length) && (
        <p>
          No matching{" "}
          {kind === "food" ? "foods" : kind === "meal" ? "meals" : "recipes"}.{" "}
          {archived
            ? "Archived items appear here."
            : "Create your first one to get started."}
        </p>
      )}
      {q.hasNextPage && (
        <button
          className="button"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </section>
  );
}
