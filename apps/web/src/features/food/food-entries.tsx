"use client";
import { FoodSourceNote } from "./food-source";
import { RetainedReadError } from "@/components/ui/retained-read-error";
import { useFoodWritePending } from "./food-write-provider";
import { useConfirm } from "@/components/ui/confirmation-provider";

import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { FoodEntryDetail } from "@168hours/contracts";
import { foodApi as api } from "./food-write-recovery";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { localDate } from "@168hours/domain-utils";
import { number, formatTime, formatDate } from "@/lib/format";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { NutritionSummary, invalidateFood } from "./food-shared";
type Actions = {
  onEdit: (e: FoodEntryDetail) => void;
  onRepeat: (e: FoodEntryDetail) => void;
};
export function FoodEntries({
  entries,
  onEdit,
  onRepeat,
  showDate = false,
}: Actions & { entries: FoodEntryDetail[]; showDate?: boolean }) {
  const confirm = useConfirm();

  const cache = useQueryClient();
  const writePending = useFoodWritePending();
  const {
    preferences: { timezone },
  } = useMe();
  const remove = useCommand({
    mutationFn: (e: FoodEntryDetail, key: string) =>
      api.deleteFoodEntry(e.id, e.version, key),
    onSuccess: () => invalidateFood(cache),
  });
  return (
    <>
      <CommandError command={remove} />
      <ul className="food-entry-list">
        {entries.map((e) => (
          <li key={e.id}>
            <div className="row between">
              <div>
                <h3>{e.nameSnapshot}</h3>
                <p className="muted">
                  {number(e.quantity)} × {e.servingAmountSnapshot}{" "}
                  {e.servingUnitSnapshot} ·{" "}
                  {showDate
                    ? `${formatDate(localDate(e.consumedAt, timezone))} · `
                    : ""}
                  {formatTime(e.consumedAt, timezone)}
                  {e.mealType !== "other" ? ` · ${e.mealType}` : ""}
                </p>
              </div>
              <div className="row">
                <button
                  className="button"
                  disabled={writePending}
                  onClick={() => onEdit(e)}
                >
                  Edit entry
                </button>
                <button
                  className="button"
                  disabled={writePending}
                  onClick={() => onRepeat(e)}
                >
                  Copy entry
                </button>
                <button
                  className="button"
                  disabled={writePending || remove.isPending}
                  onClick={async () => {
                    if (
                      await confirm(`Delete ${e.nameSnapshot} from your log?`)
                    )
                      remove.mutate(e);
                  }}
                >
                  Delete entry
                </button>
              </div>
            </div>
            <details>
              <summary>Recorded nutrition and portions</summary>
              <FoodSourceNote source={e.sourceSnapshot} />
              <NutritionSummary totals={e.nutrition} />
              {e.ingredientsSnapshot.length > 0 && (
                <ul>
                  {e.ingredientsSnapshot.map((i, index) => (
                    <li key={index}>
                      {i.name} ·{" "}
                      {number(
                        (i.quantity * e.quantity) / e.yieldServingsSnapshot,
                      )}{" "}
                      × {i.servingAmount} {i.servingUnit}
                      <FoodSourceNote source={i.source} />
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
export function FoodDayEntries({
  entries,
  onLogMeal,
  ...actions
}: Actions & {
  entries: FoodEntryDetail[];
  onLogMeal: (type: FoodEntryDetail["mealType"]) => void;
}) {
  const pending = useFoodWritePending();
  return (
    <div className="food-meal-groups">
      {(
        [
          ["breakfast", "Breakfast"],
          ["lunch", "Lunch"],
          ["dinner", "Dinner"],
          ["snack", "Snacks"],
          ["other", "Other food & drinks"],
        ] as const
      ).map(([type, label]) => {
        const items = entries.filter((entry) => entry.mealType === type);
        if (type === "other" && !items.length) return null;
        return (
          <section className="food-meal-group" key={type} aria-label={label}>
            <div className="row between">
              <h3>{label}</h3>
              <button
                className="text-button"
                disabled={pending}
                onClick={() => onLogMeal(type)}
              >
                Log{" "}
                {type === "other"
                  ? "other food"
                  : type === "snack"
                    ? "snack"
                    : type}
              </button>
            </div>
            {items.length ? (
              <FoodEntries entries={items} {...actions} />
            ) : (
              <p className="muted text-small">Nothing logged yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
export function FoodHistory(actions: Actions) {
  const [search, setSearch] = useState("");
  const q = useInfiniteQuery({
    queryKey: ["food", "history", search],
    queryFn: ({ pageParam }) =>
      api.getFoodHistory({ search, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  return (
    <section className="form-stack">
      <h2>Search past entries</h2>
      <p className="muted">
        Most recently added entries first. Copy an entry to the selected day
        using its original nutrition.
      </p>
      <label className="field">
        Search recorded foods
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {q.isPending ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <FoodEntries
          {...actions}
          entries={q.data!.pages.flatMap((p) => p.items)}
          showDate
        />
      )}
      {!q.error && q.data?.pages.every((p) => !p.items.length) && (
        <p>No recorded food yet.</p>
      )}
      <RetainedReadError query={q} label="food history" />
      {q.hasNextPage && !q.error && (
        <button
          className="button"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          Older entries
        </button>
      )}
    </section>
  );
}
