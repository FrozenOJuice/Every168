"use client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Star } from "lucide-react";
import type { Food } from "@168hours/contracts";
import { api } from "@/lib/api";
import { number } from "@/lib/format";
export function FoodFavourites({ onLog }: { onLog: (food: Food) => void }) {
  const q = useQuery({
    queryKey: ["food", "quick-favourites"],
    queryFn: () => api.getFoods({ favourite: "true", limit: 4 }),
  });
  if (!q.data?.items.length || q.error) return null;
  return (
    <section className="food-favourites" aria-label="Quick favourites">
      <h2>
        <Star size={15} aria-hidden="true" /> Your favourites
      </h2>
      <div>
        {q.data.items.map((food) => (
          <button
            key={food.id}
            onClick={() => onLog(food)}
            aria-label={`Log ${food.name}`}
          >
            <span>
              <strong>{food.name}</strong>
              <small>
                {food.calories === null
                  ? "Nutrition optional"
                  : `${number(food.calories)} kcal / serving`}
              </small>
            </span>
            <Plus size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
