"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { CatalogueFood } from "@168hours/contracts";
import { foodApi } from "./food-write-recovery";
import { useFoodWritePending } from "./food-write-provider";
import { nutrients } from "./food-shared";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { RetainedReadError } from "@/components/ui/retained-read-error";
import { number } from "@/lib/format";
export function FoodCatalogue({
  search,
  onChoose,
}: {
  search: string;
  onChoose: (food: CatalogueFood) => void;
}) {
  const [selected, setSelected] = useState<CatalogueFood | null>(null);
  const pending = useFoodWritePending();
  const q = useInfiniteQuery({
    queryKey: ["food", "catalogue", search.trim()],
    queryFn: ({ pageParam }) =>
      foodApi.searchFoodCatalogue({
        search: search.trim(),
        offset: pageParam,
        limit: 20,
      }),
    initialPageParam: 0,
    getNextPageParam: (p) => p.nextOffset ?? undefined,
    enabled: search.trim().length >= 2,
  });
  return (
    <section className="form-stack" aria-label="Food catalogue">
      <h3>Food catalogue</h3>
      <p className="muted text-small">
        Shared reference foods are read-only. Search at least two characters,
        and choose the matching raw or cooked description.
      </p>
      {search.trim().length >= 2 &&
        (q.isPending ? (
          <Loading />
        ) : q.error && !q.data ? (
          <ErrorState error={q.error} retry={() => void q.refetch()} />
        ) : (
          <>
            <p role="status" className="muted text-small">
              {q.data?.pages[0]?.total ?? 0} catalogue matches
            </p>
            <ul className="food-picker">
              {q.data?.pages
                .flatMap((p) => p.items)
                .map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="button"
                      disabled={pending}
                      onClick={() => setSelected(f)}
                      aria-label={`Review ${f.name}`}
                    >
                      {f.name}
                      <small>
                        {f.provider.toUpperCase()} {f.release} ·{" "}
                        {f.servingAmount} {f.servingUnit} ·{" "}
                        {f.calories === null
                          ? "Calories unknown"
                          : `${number(f.calories)} kcal`}
                      </small>
                    </button>
                  </li>
                ))}
            </ul>
            <RetainedReadError query={q} label="catalogue foods" />
            {q.hasNextPage && !q.error && (
              <button
                type="button"
                className="button"
                disabled={pending || q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                More catalogue foods
              </button>
            )}
          </>
        ))}
      {selected && (
        <article
          className="panel form-stack"
          aria-label="Catalogue food preview"
        >
          <h3>{selected.name}</h3>
          <p>
            Nutrition per {selected.servingAmount} {selected.servingUnit}
          </p>
          <dl className="food-nutrients">
            {nutrients.map(([key, label, unit]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {selected[key] === null
                    ? "Unknown"
                    : `${number(selected[key])} ${unit}`}
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted text-small">
            {selected.provider.toUpperCase()} {selected.release} · Food{" "}
            {selected.code}. Amounts can use grams or the available source
            portions.
          </p>
          <button
            type="button"
            className="button primary"
            disabled={pending}
            onClick={() => onChoose(selected)}
          >
            Use food
          </button>
        </article>
      )}
      <p className="muted text-small">
        Source:{" "}
        <a
          target="_blank"
          rel="noreferrer"
          href="https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-about-us.html"
        >
          Health Canada, CNF 2026
        </a>
        . Contains information licensed under the{" "}
        <a
          target="_blank"
          rel="noreferrer"
          href="https://open.canada.ca/en/open-government-licence-canada"
        >
          Open Government Licence – Canada
        </a>
        . Not endorsed by Health Canada.
      </p>
    </section>
  );
}
