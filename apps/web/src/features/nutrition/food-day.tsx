"use client";
import { useQuery } from "@tanstack/react-query";
import type { FoodEntry } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { number } from "@/lib/format";
import { NutritionSummary } from "./nutrition-totals";
import { FoodEntryRow } from "./food-entry-row";

export function FoodDay({
  date,
  onAdd,
  onEdit,
  onRepeat,
  onDelete,
  onHistory,
  deleting,
}: {
  date: string;
  onAdd: (meal: FoodEntry["mealType"]) => void;
  onEdit: (entry: FoodEntry) => void;
  onRepeat: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
  onHistory: () => void;
  deleting: boolean;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const daily = useQuery({
    queryKey: ["nutrition", date, timezone],
    queryFn: () => api.getNutritionDaily(date),
  });
  if (daily.isPending) return <Loading />;
  if (daily.error)
    return (
      <ErrorState error={daily.error} retry={() => void daily.refetch()} />
    );
  return (
    <div className="stack">
      <NutritionSummary totals={daily.data.totals} count={daily.data.count} />
      <section
        className="panel food-meals"
        id="food-meals"
        aria-labelledby="food-meals-heading"
      >
        <div className="row between">
          <h2 id="food-meals-heading">Meals</h2>
          <button className="button" onClick={onHistory}>
            Recent food
          </button>
        </div>
        {daily.data.meals.map((meal) => (
          <section
            className="food-meal"
            key={meal.mealType}
            aria-label={meal.mealType}
          >
            <div className="row between food-meal-heading">
              <div>
                <h3>{meal.mealType}</h3>
                <small>
                  {meal.count
                    ? number(meal.totals.calories.value!) + " kcal logged"
                    : "Nothing logged"}
                </small>
              </div>
              <button className="button" onClick={() => onAdd(meal.mealType)}>
                Add {meal.mealType}
              </button>
            </div>
            {meal.count > 0 && (
              <ul className="record-list">
                {daily.data.entries
                  .filter((entry) => entry.mealType === meal.mealType)
                  .map((entry) => (
                    <FoodEntryRow
                      key={entry.id}
                      entry={entry}
                      timezone={timezone}
                    >
                      <button
                        className="button"
                        onClick={() => onRepeat(entry)}
                      >
                        Log again
                      </button>
                      <button className="button" onClick={() => onEdit(entry)}>
                        Edit
                      </button>
                      <button
                        className="button danger"
                        disabled={deleting}
                        onClick={() => onDelete(entry)}
                      >
                        Delete
                      </button>
                    </FoodEntryRow>
                  ))}
              </ul>
            )}
          </section>
        ))}
      </section>
    </div>
  );
}
