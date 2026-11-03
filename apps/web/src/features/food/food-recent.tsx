"use client";
import { useQuery } from "@tanstack/react-query";
import type { FoodEntryDetail } from "@168hours/contracts";
import { foodApi } from "./food-write-recovery";
import { useFoodWritePending } from "./food-write-provider";
import { number } from "@/lib/format";

export function FoodRecent({
  onChoose,
}: {
  onChoose: (entry: FoodEntryDetail) => void;
}) {
  const disabled = useFoodWritePending();
  const query = useQuery({
    queryKey: ["food", "recent-entries"],
    queryFn: () => foodApi.getFoodHistory({ limit: 20 }),
  });
  const seen = new Set<string>();
  const entries = (query.data?.items ?? [])
    .filter((entry) => {
      const key = JSON.stringify([
        entry.foodId,
        entry.nameSnapshot,
        entry.servingAmountSnapshot,
        entry.servingUnitSnapshot,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
  if (!entries.length) return null;
  return (
    <section className="food-recent" aria-label="Recently logged">
      <h3>Recently logged</h3>
      <div>
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="button"
            disabled={disabled}
            onClick={() => onChoose(entry)}
            aria-label={`Use ${entry.nameSnapshot}`}
          >
            <strong>{entry.nameSnapshot}</strong>
            <small>
              {number(entry.quantity)} × {entry.servingAmountSnapshot}{" "}
              {entry.servingUnitSnapshot}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
